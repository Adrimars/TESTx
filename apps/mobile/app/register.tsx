import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { MOBILE_MIN_AGE } from "@testx/shared";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { useSession } from "@/lib/session";
import { getDeviceId } from "@/lib/device";
import { useRegistrationDraft } from "@/lib/registrationDraft";
import { checkField, registerSchema } from "@/lib/validation";
import { theme } from "@/lib/theme";

/**
 * Registration. Two things are deliberately sequenced before the account is
 * created: the 18+ self-attested checkbox, and the Aydinlatma Metni
 * acknowledgment, which is a separate full screen rather than a checkbox.
 *
 * Age itself is never persisted here (16.8) - the numeric field this screen used to show
 * only ever existed to gate under-18 signups client-side; the real, persisted
 * `EvaluatorProfile.age` is still collected once, on profile-onboarding.tsx.
 *
 * The form survives the detour to /aydinlatma in `RegistrationDraftProvider`, not in
 * navigation params - see registrationDraft.tsx for why the password must not be one.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useSession();
  const { draft, updateDraft, clearDraft } = useRegistrationDraft();

  const [email, setEmail] = useState(draft.email);
  const [password, setPassword] = useState(draft.password);
  const [confirmPassword, setConfirmPassword] = useState(draft.confirmPassword);
  const [ageConfirmed, setAgeConfirmed] = useState(draft.ageConfirmed);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  const acknowledged = draft.acknowledged;

  function validate(): boolean {
    const next: Record<string, string | null> = {
      email: checkField(registerSchema, "email", email),
      password: checkField(registerSchema, "password", password),
      confirmPassword: password === confirmPassword ? null : "Passwords do not match",
      ageConfirmed: ageConfirmed
        ? null
        : `You must confirm you are ${MOBILE_MIN_AGE} or older to create an account`,
    };
    setErrors(next);
    return !next.email && !next.password && !next.confirmPassword && !next.ageConfirmed;
  }

  function handleContinueToDisclosure() {
    if (!validate()) return;
    updateDraft({ email, password, confirmPassword, ageConfirmed });
    router.push("/aydinlatma");
  }

  async function handleCreateAccount() {
    if (!validate()) return;
    setBusy(true);
    try {
      await signUp({
        email,
        password,
        ageConfirmed: true,
        aydinlatmaAcknowledged: true,
        deviceId: await getDeviceId(),
        // No acik riza is collected in v1; the plan explicitly says not to build
        // that checkbox speculatively while its legal basis is unconfirmed.
      });
      // The account exists; nothing is left to resume, so drop the credentials from
      // memory rather than leaving them in the provider for the rest of the session.
      clearDraft();
      router.replace("/profile-onboarding");
    } catch (error) {
      Alert.alert(
        "Registration failed",
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
        <Text style={styles.title}>Create your account</Text>

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          placeholder="At least 8 characters"
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry
        />
        <Field
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={errors.confirmPassword}
          placeholder="Re-enter your password"
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry
        />

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ageConfirmed }}
          accessibilityLabel={`I confirm I am ${MOBILE_MIN_AGE} or older`}
          onPress={() => setAgeConfirmed((prev) => !prev)}
          style={styles.checkboxRow}
        >
          <View style={[styles.checkbox, ageConfirmed && styles.checkboxChecked]}>
            {ageConfirmed ? (
              <Check size={16} color={theme.colors.accentContrast} strokeWidth={3} />
            ) : null}
          </View>
          <Text style={styles.checkboxLabel}>I confirm I am {MOBILE_MIN_AGE} or older.</Text>
        </Pressable>
        {errors.ageConfirmed ? <Text style={styles.checkboxError}>{errors.ageConfirmed}</Text> : null}

        {acknowledged ? (
          <View style={styles.acknowledged}>
            <Text style={styles.acknowledgedText}>Aydinlatma Metni okundu.</Text>
          </View>
        ) : null}

        {acknowledged ? (
          <Button label="Create account" onPress={handleCreateAccount} loading={busy} />
        ) : (
          <Button label="Continue" onPress={handleContinueToDisclosure} />
        )}

        <Button label="I already have an account" variant="quiet" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: theme.spacing(3),
    gap: theme.spacing(2),
  },
  title: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: "700" },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1.25),
    // 44pt minimum touch target (prd.md §16.7).
    minHeight: 44,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  checkboxLabel: { color: theme.colors.textPrimary, fontSize: 14, flexShrink: 1 },
  checkboxError: { color: theme.colors.danger, fontSize: 13 },
  acknowledged: {
    borderWidth: 1,
    borderColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: 10,
    padding: theme.spacing(1.5),
  },
  acknowledgedText: { color: theme.colors.textPrimary, fontSize: 14 },
});
