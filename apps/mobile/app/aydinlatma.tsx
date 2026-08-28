import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";
import {
  AYDINLATMA_METNI_IS_PLACEHOLDER,
  AYDINLATMA_METNI_SECTIONS,
  AYDINLATMA_METNI_TITLE,
} from "@/content/aydinlatmaMetni";
import { useRegistrationDraft } from "@/lib/registrationDraft";
import { useSession } from "@/lib/session";
import { theme } from "@/lib/theme";

/**
 * KVKK Article 10 disclosure. This is an acknowledgment, NOT consent: the user
 * confirms they have read it, and nothing on this screen may be presented as
 * agreeing to optional processing. Kurul Ilke Karari 2026/347 prohibits merging
 * the disclosure with an acik riza action, so no consent control belongs here.
 *
 * The same text serves two entry points:
 *
 * - *Registration*: pushed from /register before the account exists. Acknowledging
 *   records the flag on the in-memory draft and returns to the form, which then sends
 *   `aydinlatmaAcknowledged` with the signup.
 * - *Post-login gate*: replaced onto by the splash or login when a signed-in user has
 *   no `aydinlatmaAcknowledgedAt` - a Google-registered account, created by the OAuth
 *   callback, which cannot show the disclosure. Acknowledging records it server-side
 *   before the app is reachable.
 */
export default function AydinlatmaScreen() {
  const router = useRouter();
  const { updateDraft } = useRegistrationDraft();
  const { user, hasProfile, needsAydinlatma, acknowledgeAydinlatma, signOut } = useSession();

  // Frozen at mount on purpose. `needsAydinlatma` is exactly the state acknowledging
  // clears, so reading it live would flip this screen into registration mode the moment
  // the POST resolves - mid-navigation, with a stale registration draft behind it.
  const [isGate] = useState(() => needsAydinlatma);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * In registration mode the acknowledgment lives on the in-memory draft rather than a
   * route param: that keeps the half-typed credentials out of navigation state on the
   * way back, and makes the flag unforgeable by deep link - only this button sets it.
   * In gate mode the server owns the flag, so a client claim would not help anyway.
   */
  async function handleAcknowledge() {
    if (!isGate) {
      updateDraft({ acknowledged: true });
      router.replace("/register");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await acknowledgeAydinlatma();
      router.replace(hasProfile ? "/dashboard" : "/profile-onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kaydedilemedi. Lutfen tekrar deneyin.");
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
        <Text style={styles.title}>{AYDINLATMA_METNI_TITLE}</Text>

        {AYDINLATMA_METNI_IS_PLACEHOLDER ? (
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              Bu metin taslaktir ve hukuki onaydan gecmemistir.
            </Text>
          </View>
        ) : null}

        {AYDINLATMA_METNI_SECTIONS.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {/* "Okundu, onaylandı" (read, confirmed) rather than a first-person "I have read
            and agreed" framing - a passive status statement reads as the neutral
            acknowledgment-of-disclosure this screen legally is, not as a consent
            statement, which the button text alone must not resemble (see the doc
            comment above). */}
        <Button label="Okundu, onaylandi" onPress={handleAcknowledge} loading={busy} />
        {/* Gate mode is entered with `replace`, so there is no back button. Without this
            a failed acknowledgment would strand the user on a screen with one control
            that does not work and no way off it. */}
        {isGate && user ? (
          <Button label="Cikis yap" variant="quiet" onPress={handleSignOut} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  scroll: { padding: theme.spacing(3), gap: theme.spacing(2), paddingBottom: theme.spacing(4) },
  title: { color: theme.colors.textPrimary, fontSize: 24, fontWeight: "700" },
  warning: {
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: 10,
    padding: theme.spacing(1.5),
  },
  warningText: { color: theme.colors.danger, fontSize: 13, fontWeight: "600" },
  section: { gap: 6 },
  heading: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "600" },
  body: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21 },
  error: { color: theme.colors.danger, fontSize: 13, marginBottom: theme.spacing(1) },
  footer: {
    padding: theme.spacing(3),
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceBase,
  },
});
