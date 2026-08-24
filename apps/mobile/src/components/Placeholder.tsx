import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";

/**
 * Scaffold shell for the Phase 9.2 screens. Each screen's real content is
 * filled in by the subphase that owns it.
 */
export function Placeholder({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3),
    backgroundColor: theme.colors.surfaceBase,
    gap: theme.spacing(1.5),
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "600",
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    textAlign: "center",
  },
});
