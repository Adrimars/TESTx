import { Pressable, StyleSheet, Text, View } from "react-native";
import { HOBBIES, HOBBIES_MAX } from "@testx/shared";
import { theme } from "@/lib/theme";

/**
 * A tappable chip grid over the predecided `HOBBIES` list (prd.md §16.7), capped at
 * `HOBBIES_MAX`. The (max+1)th tap on a new chip is a no-op until one is deselected,
 * mirroring `MultiSelectCard`'s existing `atMax` guard pattern (15.1) rather than
 * silently dropping the oldest pick or overwriting anything.
 */
export function HobbiesPicker({
  label,
  value,
  onChange,
  error,
}: {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  error?: string | null;
}) {
  const atMax = value.length >= HOBBIES_MAX;

  function toggle(hobbyValue: string) {
    if (value.includes(hobbyValue)) {
      onChange(value.filter((selected) => selected !== hobbyValue));
      return;
    }
    if (atMax) return;
    onChange([...value, hobbyValue]);
  }

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={styles.label}>
          {label} ({value.length}/{HOBBIES_MAX})
        </Text>
      ) : null}
      <View style={styles.grid}>
        {HOBBIES.map((hobby) => {
          const selected = value.includes(hobby.value);
          const disabled = !selected && atMax;
          return (
            <Pressable
              key={hobby.value}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => toggle(hobby.value)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                disabled && styles.chipDisabled,
                pressed && !disabled && styles.chipPressed,
              ]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {hobby.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing(1) },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: 20,
    paddingHorizontal: theme.spacing(1.75),
    // 44pt minimum touch target (prd.md §16.7).
    minHeight: 44,
    justifyContent: "center",
  },
  chipSelected: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipDisabled: { opacity: 0.4 },
  chipPressed: { opacity: 0.75 },
  chipText: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" },
  chipTextSelected: { color: theme.colors.accentContrast },
  error: { color: theme.colors.danger, fontSize: 13 },
});
