import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MOBILE_MIN_AGE } from "@testx/shared";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { useSession } from "@/lib/session";
import { getDeviceId } from "@/lib/device";
import { checkField, registerSchema } from "@/lib/validation";
import { theme } from "@/lib/theme";

/**
 * Registration. Two things are deliberately sequenced before the account is
 * created: the 18+ self-declared age gate, and the Aydinlatma Metni
 * acknowledgment, which is a separate full screen rather than a checkbox.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useSession();
  const params = useLocalSearchParams<{
    email?: string;
    password?: string;
    age?: string;
    acknowledged?: string;
  }>();

  const [email, setEmail] = useState(params.email ?? "");
  const [password, setPassword] = useState(params.password ?? "");
  const [age, setAge] = useState(params.age ?? "");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);

  const acknowledged = params.acknowledged === "1";

  function validate(): boolean {
    const parsedAge = Number.parseInt(age, 10);
    const next: Record<string, string | null> = {
      email: checkField(registerSchema, "email", email),
      password: checkField(registerSchema, "password", password),
      age: Number.isNaN(parsedAge)
        ? "Enter your age"
        : parsedAge < MOBILE_MIN_AGE
          ? `You must be at least ${MOBILE_MIN_AGE} to create an account`
          : parsedAge > 120
            ? "Enter a valid age"
            : null,
    };
    setErrors(next);
    return !next.email && !next.password && !next.age;
  }

  function handleContinueToDisclosure() {
    if (!validate()) return;
    router.push({ pathname: "/aydinlatma", params: { email, password, age } });
  }

  async function handleCreateAccount() {
    if (!validate()) return;
    setBusy(true);
    try {
      await signUp({
        email,
        password,
        age: Number.parseInt(age, 10),
        aydinlatmaAcknowledged: true,
        deviceId: await getDeviceId(),
        // No acik riza is collected in v1; the plan explicitly says not to build
        // that checkbox speculatively while its legal basis is unconfirmed.
      });
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
          label="Age"
          value={age}
          onChangeText={setAge}
          error={errors.age}
          placeholder={`${MOBILE_MIN_AGE} or older`}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={3}
        />
        <Text style={styles.note}>
          TESTx is only available to people aged {MOBILE_MIN_AGE} and over.
        </Text>

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
  note: { color: theme.colors.textSecondary, fontSize: 13 },
  acknowledged: {
    borderWidth: 1,
    borderColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: 10,
    padding: theme.spacing(1.5),
  },
  acknowledgedText: { color: theme.colors.textPrimary, fontSize: 14 },
});
