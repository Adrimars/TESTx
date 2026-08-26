import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AI_EXPERIENCE_OPTIONS,
  AI_FREQUENCY_OPTIONS,
  COUNTRIES,
  EDUCATION_LEVELS,
  GENDERS,
  MOBILE_MIN_AGE,
  type CurrentUser,
} from "@testx/shared";
import { AvatarPicker } from "@/components/AvatarPicker";
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

export default function ProfileScreen() {
  const { user, refreshUser } = useSession();

  const profile = user?.evaluatorProfile ?? null;

  const [age, setAge] = useState(profile ? String(profile.age) : "");
  const [gender, setGender] = useState<string | null>(profile?.gender ?? null);
  const [country, setCountry] = useState<string | null>(profile?.country ?? null);
  const [city, setCity] = useState(profile?.city ?? "");
  const [nativeLanguage, setNativeLanguage] = useState(profile?.nativeLanguage ?? "");
  const [occupation, setOccupation] = useState(profile?.occupation ?? "");
  const [educationLevel, setEducationLevel] = useState<string | null>(
    profile?.educationLevel ?? null
  );
  const [aiExperience, setAiExperience] = useState<string | null>(profile?.aiExperience ?? null);
  const [aiFrequency, setAiFrequency] = useState<string | null>(profile?.aiFrequency ?? null);
  const [avatarId, setAvatarId] = useState<number | null>(user?.avatarId ?? null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // The screen can mount before /auth/me has returned on a cold start.
  useEffect(() => {
    if (!user) return;
    setAvatarId(user.avatarId ?? null);
    const p = user.evaluatorProfile;
    if (!p) return;
    setAge(String(p.age));
    setGender(p.gender);
    setCountry(p.country);
    setCity(p.city ?? "");
    setNativeLanguage(p.nativeLanguage ?? "");
    setOccupation(p.occupation ?? "");
    setEducationLevel(p.educationLevel ?? null);
    setAiExperience(p.aiExperience ?? null);
    setAiFrequency(p.aiFrequency ?? null);
  }, [user]);

  async function handleSelectAvatar(nextAvatarId: number) {
    const previous = avatarId;
    setAvatarId(nextAvatarId); // optimistic; the grid should feel instant
    try {
      await apiFetch<CurrentUser>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ avatarId: nextAvatarId }),
      });
      await refreshUser();
    } catch (error) {
      setAvatarId(previous);
      Alert.alert(
        "Could not change avatar",
        error instanceof Error ? error.message : "Please try again."
      );
    }
  }

  async function handleSave() {
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
      nativeLanguage: nativeLanguage.trim() || undefined,
      occupation: occupation.trim() || undefined,
      educationLevel: educationLevel ?? undefined,
      aiExperience: aiExperience ?? undefined,
      aiFrequency: aiFrequency ?? undefined,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      await apiFetch("/evaluator/profile", { method: "PUT", body: JSON.stringify(parsed.data) });
      await refreshUser();
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (error) {
      Alert.alert("Could not save", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={["top"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <AvatarPicker value={avatarId} onChange={handleSelectAvatar} />

          <Text style={styles.email}>{user?.email}</Text>

          <Field
            label="Age"
            value={age}
            onChangeText={setAge}
            error={errors.age}
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
          <Field
            label="Native language (Optional)"
            value={nativeLanguage}
            onChangeText={setNativeLanguage}
            error={errors.nativeLanguage}
            placeholder="Optional"
          />
          <Field
            label="Occupation (Optional)"
            value={occupation}
            onChangeText={setOccupation}
            error={errors.occupation}
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

          <Button label="Save changes" onPress={handleSave} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  container: { padding: theme.spacing(3), gap: theme.spacing(2), paddingBottom: theme.spacing(6) },
  email: { color: theme.colors.textSecondary, fontSize: 14 },
});
