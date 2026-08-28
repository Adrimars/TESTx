import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
import { HobbiesPicker } from "@/components/HobbiesPicker";
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
  const [hobbies, setHobbies] = useState<string[]>([]);
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
      hobbies,
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
      // The mandatory hands-on practice test (17.x) - see practice-test.tsx's own doc for
      // why this is where it's triggered, rather than a persisted seen-it flag. Named here
      // rather than sprung silently, so the deck that opens next doesn't read as a real
      // test the account already got assigned.
      Alert.alert(
        "You're all set!",
        "Now let's do a short, hands-on tutorial so you know how each kind of question works.",
        [{ text: "Let's go", onPress: () => router.replace("/practice-test") }]
      );
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
          label="City (Optional)"
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

        <View style={styles.hobbiesHeader}>
          <Text style={styles.hobbiesTitle}>Hobbies (Optional)</Text>
          {hobbies.length > 0 ? (
            <Pressable onPress={() => setHobbies([])} accessibilityRole="button">
              <Text style={styles.skipLabel}>Skip</Text>
            </Pressable>
          ) : null}
        </View>
        <HobbiesPicker value={hobbies} onChange={setHobbies} error={errors.hobbies} />

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
  hobbiesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing(1),
  },
  hobbiesTitle: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" },
  // A skippable step needs its own explicit "leave this blank" tap target (prd.md
  // §16.7), not just the implicit skip of never tapping a chip - only shown once
  // something is picked, since an empty selection is already the skipped state.
  skipLabel: { color: theme.colors.accent, fontSize: 13, fontWeight: "600" },
});
