import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
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
import { HobbiesPicker } from "@/components/HobbiesPicker";
import { Select } from "@/components/Select";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import {
  confirmLeavingUnsavedProfileChanges,
  registerUnsavedProfileChanges,
} from "@/lib/unsavedProfileChanges";
import { evaluatorProfileSchema, fieldErrors } from "@/lib/validation";
import { theme } from "@/lib/theme";

const GENDER_OPTIONS = GENDERS.map((gender) => ({
  value: gender,
  label: gender.charAt(0) + gender.slice(1).toLowerCase(),
}));

/** The editable fields, as a plain comparable snapshot - everything the dirty check and
 * the discard action need, deliberately excluding avatarId (see below). */
type ProfileFormSnapshot = {
  age: string;
  gender: string | null;
  country: string | null;
  city: string;
  nativeLanguage: string;
  occupation: string;
  educationLevel: string | null;
  aiExperience: string | null;
  aiFrequency: string | null;
  hobbies: string[];
};

const EMPTY_SNAPSHOT: ProfileFormSnapshot = {
  age: "",
  gender: null,
  country: null,
  city: "",
  nativeLanguage: "",
  occupation: "",
  educationLevel: null,
  aiExperience: null,
  aiFrequency: null,
  hobbies: [],
};

function snapshotFromProfile(profile: CurrentUser["evaluatorProfile"]): ProfileFormSnapshot {
  if (!profile) return EMPTY_SNAPSHOT;
  return {
    age: String(profile.age),
    gender: profile.gender,
    country: profile.country,
    city: profile.city ?? "",
    nativeLanguage: profile.nativeLanguage ?? "",
    occupation: profile.occupation ?? "",
    educationLevel: profile.educationLevel ?? null,
    aiExperience: profile.aiExperience ?? null,
    aiFrequency: profile.aiFrequency ?? null,
    hobbies: profile.hobbies ?? [],
  };
}

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
  const [hobbies, setHobbies] = useState<string[]>(profile?.hobbies ?? []);
  // Avatar saves itself the instant it's tapped (see handleSelectAvatar) - it was never
  // part of the "unsaved changes" this screen tracks, and stays that way here.
  const [avatarId, setAvatarId] = useState<number | null>(user?.avatarId ?? null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // What the form would revert to. Updated alongside the fields whenever fresh server
  // data arrives (cold start, or right after a successful save) - never by typing.
  const baselineRef = useRef<ProfileFormSnapshot>(snapshotFromProfile(profile));

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
    setHobbies(p.hobbies ?? []);
    baselineRef.current = snapshotFromProfile(p);
  }, [user]);

  const snapshot: ProfileFormSnapshot = {
    age,
    gender,
    country,
    city,
    nativeLanguage,
    occupation,
    educationLevel,
    aiExperience,
    aiFrequency,
    hobbies,
  };
  const isDirty = useMemo(
    () => JSON.stringify(snapshot) !== JSON.stringify(baselineRef.current),
    [age, gender, country, city, nativeLanguage, occupation, educationLevel, aiExperience, aiFrequency, hobbies]
  );

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

  /** Returns whether the save actually succeeded - the unsaved-changes guard needs to
   * know before it lets a pending navigation through. */
  async function handleSave(): Promise<boolean> {
    const parsedAge = Number.parseInt(age, 10);
    if (!Number.isNaN(parsedAge) && parsedAge < MOBILE_MIN_AGE) {
      setErrors({ age: `You must be at least ${MOBILE_MIN_AGE} to use TESTx` });
      return false;
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
      hobbies,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return false;
    }

    setErrors({});
    setSaving(true);
    try {
      await apiFetch("/evaluator/profile", { method: "PUT", body: JSON.stringify(parsed.data) });
      await refreshUser();
      // refreshUser's response is what feeds the baseline-resetting effect above, so the
      // sticky bar clears itself the moment the new user object lands - no separate
      // "Saved" alert needed on top of that.
      return true;
    } catch (error) {
      Alert.alert("Could not save", error instanceof Error ? error.message : "Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** Reverts every tracked field to the last-saved snapshot, discarding the edit in
   * place rather than waiting on a refetch. */
  function handleDiscard() {
    const b = baselineRef.current;
    setAge(b.age);
    setGender(b.gender);
    setCountry(b.country);
    setCity(b.city);
    setNativeLanguage(b.nativeLanguage);
    setOccupation(b.occupation);
    setEducationLevel(b.educationLevel);
    setAiExperience(b.aiExperience);
    setAiFrequency(b.aiFrequency);
    setHobbies(b.hobbies);
    setErrors({});
  }

  // Always-fresh refs rather than re-registering on every keystroke: the tab bar and the
  // hardware back button both call through confirmLeavingUnsavedProfileChanges at an
  // arbitrary later moment, so what they need is whatever isDirty/handleSave/handleDiscard
  // are *at that moment*, not whichever closure happened to be registered last.
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const handleDiscardRef = useRef(handleDiscard);
  handleDiscardRef.current = handleDiscard;

  useEffect(() => {
    registerUnsavedProfileChanges({
      isDirty: () => isDirtyRef.current,
      save: () => handleSaveRef.current(),
      discard: () => handleDiscardRef.current(),
    });
    return () => registerUnsavedProfileChanges(null);
  }, []);

  // Android's hardware back button doesn't go through the tab bar's own tabPress guard
  // (see (tabs)/_layout.tsx) - this is the same confirm, wired to the one other way off
  // this screen. Only armed while Profile is the focused screen.
  useFocusEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!isDirtyRef.current) return false;
      void confirmLeavingUnsavedProfileChanges();
      // Always consumed while dirty: the confirm dialog is the response to this press,
      // not the back navigation the button would otherwise have triggered.
      return true;
    });
    return () => subscription.remove();
  });

  return (
    <SafeAreaView style={styles.flex} edges={["top"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.container, isDirty && styles.containerWithBar]}
          keyboardShouldPersistTaps="handled"
        >
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
          <HobbiesPicker
            label="Hobbies (Optional)"
            value={hobbies}
            onChange={setHobbies}
            error={errors.hobbies}
          />
        </ScrollView>

        {isDirty ? (
          <View style={styles.saveBar}>
            <Button
              label="Discard"
              variant="secondary"
              onPress={handleDiscard}
              disabled={saving}
            />
            <View style={styles.saveButtonFlex}>
              <Button label="Save changes" onPress={() => void handleSave()} loading={saving} />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  container: { padding: theme.spacing(3), gap: theme.spacing(2), paddingBottom: theme.spacing(3) },
  // The sticky bar sits on top of the scroll content, not inline with it - this keeps
  // the last field it covers reachable by scrolling past it instead of behind it.
  containerWithBar: { paddingBottom: theme.spacing(11) },
  email: { color: theme.colors.textSecondary, fontSize: 14 },
  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceRaised,
  },
  saveButtonFlex: { flex: 1 },
});
