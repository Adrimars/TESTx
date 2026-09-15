import { StyleSheet, Text, View } from "react-native";
import {
  AYDINLATMA_METNI_IS_PLACEHOLDER,
  AYDINLATMA_METNI_SECTIONS,
  AYDINLATMA_METNI_TITLE,
} from "@/content/aydinlatmaMetni";
import { theme } from "@/lib/theme";

/**
 * The disclosure text itself, shared between the post-login gate
 * (app/aydinlatma.tsx) and the registration checkbox's AydinlatmaMetniModal - one
 * legal text rendered from one place. Callers own the scroll container.
 */
export function AydinlatmaMetniBody() {
  return (
    <>
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
    </>
  );
}

const styles = StyleSheet.create({
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
});
