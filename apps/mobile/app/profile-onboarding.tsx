import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import {
  AI_EXPERIENCE_OPTIONS,
  AI_FREQUENCY_OPTIONS,
  COUNTRIES,
  EDUCATION_LEVELS,
  GENDERS,
  MOBILE_MIN_AGE,
} from "@testx/shared";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { evaluatorProfileSchema, fieldErrors } from "@/lib/validation";
import { theme } from "@/lib/theme";

const GENDER_OPTIONS = GENDERS.map((gender) => ({
  value: gender,
  label: gender.charAt(0) + gender.slice(1).toLowerCase(),
}));

/**
 * The API refuses to serve the feed with PROFILE_REQUIRED until this is filled
 * in, so onboarding is not skippable. Validation runs against the shared
 * evaluatorProfileSchema, with the age floor raised to the mobile 18+ gate.
 */
export default function ProfileOnboardingScreen() {
  const router = useRouter();
  const { refreshUser } = useSession();

  const [age, setAge] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [educationLevel, setEducationLevel] = useState<string | null>(null);
  const [aiExperience, setAiExperience] = useState<string | null>(null);
  const [aiFrequency, setAiFrequency] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    const parsedAge = Number.parseInt(age, 10);

    if (!Number.isNaN(parsedAge) && parsedAge < MOBILE_MIN_AGE) {
      setErrors({ age: `You must be at least ${MOBILE_MIN_AGE} to use TESTx` });
      return;
    }

    const parsed = evaluatorProfileSchema.safeParse({
      age: Number.isNaN(parsedAge) ? undefined : parsedAge,
      gender,
      country,
      city: city.trim() || undefined,
      educationLevel: educationLevel ?? undefined,
      aiExperience: aiExperience ?? undefined,
      aiFrequency: aiFrequency ?? undefined,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setBusy(true);
    try {
      await apiFetch("/evaluator/profile", {
        method: "PUT",
        body: JSON.stringify(parsed.data),
      });
      await refreshUser();
      router.replace("/dashboard");
    } catch (error) {
      Alert.alert(
        "Could not save profile",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Tell us about you</Text>
        <Text style={styles.subtitle}>
          Your answers decide which tests you are eligible for.
        </Text>

        <Field
          label="Age"
          value={age}
          onChangeText={setAge}
          error={errors.age}
          placeholder={`${MOBILE_MIN_AGE} or older`}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={3}
        />
        <Select
          label="Gender"
          options={GENDER_OPTIONS}
          value={gender}
          onChange={setGender}
          error={errors.gender}
        />
        <Select
          label="Country"
          options={COUNTRIES}
          value={country}
          onChange={setCountry}
          error={errors.country}
          searchable
        />
        <Field
          label="City"
          value={city}
          onChangeText={setCity}
          error={errors.city}
          placeholder="Optional"
        />
        <Select
          label="Education level"
          options={EDUCATION_LEVELS}
          value={educationLevel}
          onChange={setEducationLevel}
          error={errors.educationLevel}
        />
        <Select
          label="AI experience"
          options={AI_EXPERIENCE_OPTIONS}
          value={aiExperience}
          onChange={setAiExperience}
          error={errors.aiExperience}
        />
        <Select
          label="How often do you use AI?"
          options={AI_FREQUENCY_OPTIONS}
          value={aiFrequency}
          onChange={setAiFrequency}
          error={errors.aiFrequency}
        />

        <Button label="Continue" onPress={handleSubmit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  container: { padding: theme.spacing(3), gap: theme.spacing(2), paddingBottom: theme.spacing(6) },
  title: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: "700" },
  subtitle: { color: theme.colors.textSecondary, fontSize: 15 },
});
