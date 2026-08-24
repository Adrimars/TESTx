import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { checkField, registerSchema } from "@/lib/validation";
import { LinkButton } from "@/components/LinkButton";
import { theme } from "@/lib/theme";

/**
 * Scaffold registration screen. It already validates against the shared Zod
 * schema so the mobile and web rules cannot drift; the full flow (18+ age gate,
 * Aydinlatma Metni acknowledgment, Google/Apple entry points) lands in 9.3.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    const emailError = checkField(registerSchema, "email", email);
    setError(emailError);
    if (!emailError) router.push("/profile-onboarding");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>
      <Text style={styles.subtitle}>
        Password rules, the 18+ age gate and the Aydinlatma Metni step land in Phase 9.3.
      </Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={theme.colors.textSecondary}
        autoCapitalize="none"
        keyboardType="email-address"
        inputMode="email"
        accessibilityLabel="Email address"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <LinkButton label="Continue" onPress={handleContinue} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing(3),
    backgroundColor: theme.colors.surfaceBase,
    gap: theme.spacing(1.5),
  },
  title: { color: theme.colors.textPrimary, fontSize: 24, fontWeight: "600" },
  subtitle: { color: theme.colors.textSecondary, fontSize: 15 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: 12,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1.5),
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  error: { color: theme.colors.danger, fontSize: 13 },
});
