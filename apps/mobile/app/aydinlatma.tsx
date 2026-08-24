import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import {
  AYDINLATMA_METNI_IS_PLACEHOLDER,
  AYDINLATMA_METNI_SECTIONS,
  AYDINLATMA_METNI_TITLE,
} from "@/content/aydinlatmaMetni";
import { theme } from "@/lib/theme";

/**
 * KVKK Article 10 disclosure. This is an acknowledgment, NOT consent: the user
 * confirms they have read it, and nothing on this screen may be presented as
 * agreeing to optional processing. Kurul Ilke Karari 2026/347 prohibits merging
 * the disclosure with an acik riza action, so no consent control belongs here.
 */
export default function AydinlatmaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; password?: string; age?: string }>();

  function handleAcknowledge() {
    router.replace({ pathname: "/register", params: { ...params, acknowledged: "1" } });
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
        <Button label="Okudum, anladim" onPress={handleAcknowledge} />
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
  footer: {
    padding: theme.spacing(3),
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceBase,
  },
});
