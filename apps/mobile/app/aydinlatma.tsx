import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AydinlatmaMetniBody } from "@/components/AydinlatmaMetniBody";
import { Button } from "@/components/Button";
import { useSession } from "@/lib/session";
import { theme } from "@/lib/theme";

/**
 * KVKK Article 10 disclosure, shown as a post-login gate: reached only when a
 * signed-in user has no `aydinlatmaAcknowledgedAt` yet - a Google-registered account,
 * created by the OAuth callback, which has no way to present it, and Google's own
 * consent screen is not a substitute. Registration acknowledges the same text inline
 * instead, through AydinlatmaMetniModal on register.tsx, so this screen no longer
 * doubles as a registration step.
 *
 * This is an acknowledgment, NOT consent: the user confirms they have read it, and
 * nothing on this screen may be presented as agreeing to optional processing. Kurul
 * Ilke Karari 2026/347 prohibits merging the disclosure with an acik riza action, so
 * no consent control belongs here.
 */
export default function AydinlatmaScreen() {
  const router = useRouter();
  const { user, hasProfile, acknowledgeAydinlatma, signOut } = useSession();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAcknowledge() {
    setBusy(true);
    setError(null);
    try {
      await acknowledgeAydinlatma();
      router.replace(hasProfile ? "/dashboard" : "/profile-onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <AydinlatmaMetniBody />
      </ScrollView>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="I've read and confirmed" onPress={handleAcknowledge} loading={busy} />
        {/* Entered with `replace`, so there is no back button. Without this a failed
            acknowledgment would strand the user on a screen with one control that
            does not work and no way off it. */}
        {user ? <Button label="Sign out" variant="quiet" onPress={handleSignOut} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  scroll: { padding: theme.spacing(3), gap: theme.spacing(2), paddingBottom: theme.spacing(4) },
  error: { color: theme.colors.danger, fontSize: 13, marginBottom: theme.spacing(1) },
  footer: {
    padding: theme.spacing(3),
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceBase,
  },
});
