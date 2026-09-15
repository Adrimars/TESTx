import { Children } from "react";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "@/lib/theme";

/**
 * Pairs a form's fields side by side on desktop instead of one long mobile-width column -
 * stacked (unchanged) below the desktop breakpoint, where a field's own wrapper already
 * stretches to the column's full width with nothing extra needed here. On desktop each
 * child is wrapped in its own `flex: 1` box so the pair splits the row evenly - `Field`
 * and `Select` (components/Field.tsx, components/Select.tsx) don't take a style prop of
 * their own to size themselves.
 *
 * Shared between every long demographic form in the app (profile-onboarding.tsx,
 * (tabs)/profile.tsx) rather than reimplemented per screen - same fields, same pairing
 * logic, same desktop treatment.
 */
export function FormRow({ isDesktopWeb, children }: { isDesktopWeb: boolean; children: ReactNode }) {
  return (
    <View style={[styles.row, isDesktopWeb && styles.rowDesktop]}>
      {isDesktopWeb
        ? Children.map(children, (child) => <View style={styles.col}>{child}</View>)
        : children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: theme.spacing(2) },
  rowDesktop: { flexDirection: "row" },
  col: { flex: 1 },
});
