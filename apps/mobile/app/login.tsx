import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { useSession } from "@/lib/session";
import { startGoogleSignIn } from "@/lib/googleAuth";
import { checkField, loginSchema } from "@/lib/validation";
import { theme } from "@/lib/theme";

/**
 * Entry screen. Email/password and Google are equally prominent and both live
 * on this first screen rather than behind an "other options" tap.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithCode } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [busy, setBusy] = useState<"email" | "google" | null>(null);

  async function handleEmailSignIn() {
    const emailError = checkField(loginSchema, "email", email);
    const passwordError = checkField(loginSchema, "password", password);
    setErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    setBusy("email");
    try {
      const user = await signIn(email, password);
      router.replace(user.evaluatorProfile ? "/feed" : "/profile-onboarding");
    } catch (error) {
      Alert.alert("Sign in failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleGoogleSignIn() {
    setBusy("google");
    try {
      const result = await startGoogleSignIn();
      if (result.type === "cancelled") return;
      if (result.type === "error") {
        Alert.alert("Google sign-in failed", result.message);
        return;
      }
      const user = await signInWithCode(result.code);
      router.replace(user.evaluatorProfile ? "/feed" : "/profile-onboarding");
    } catch (error) {
      Alert.alert("Sign in failed", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.wordmark}>TESTx</Text>

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
          placeholder="Your password"
          autoCapitalize="none"
          autoComplete="current-password"
          secureTextEntry
        />
        <Button
          label="Sign in"
          onPress={handleEmailSignIn}
          loading={busy === "email"}
          disabled={busy !== null}
        />

        <View style={styles.divider}>
          <View style={styles.rule} />
          <Text style={styles.dividerLabel}>or</Text>
          <View style={styles.rule} />
        </View>

        <Button
          label="Continue with Google"
          variant="secondary"
          onPress={handleGoogleSignIn}
          loading={busy === "google"}
          disabled={busy !== null}
        />

        <Button
          label="Create an account"
          variant="quiet"
          onPress={() => router.push("/register")}
          disabled={busy !== null}
        />
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
  wordmark: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: theme.spacing(2),
  },
  divider: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1.5) },
  rule: { flex: 1, height: 1, backgroundColor: theme.colors.borderHairline },
  dividerLabel: { color: theme.colors.textSecondary, fontSize: 13 },
});
