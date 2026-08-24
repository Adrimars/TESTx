import { Pressable, StyleSheet, Text } from "react-native";
import { theme } from "@/lib/theme";

export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      accessibilityRole="button"
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: theme.spacing(1),
    paddingVertical: theme.spacing(1.5),
    paddingHorizontal: theme.spacing(3),
    borderRadius: 12,
    backgroundColor: theme.colors.accent,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  label: {
    color: theme.colors.accentContrast,
    fontSize: 16,
    fontWeight: "600",
  },
});
