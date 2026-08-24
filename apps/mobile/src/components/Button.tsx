import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { theme } from "@/lib/theme";

type Variant = "primary" | "secondary" | "quiet";

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "quiet" && styles.quiet,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? theme.colors.accentContrast : theme.colors.textPrimary} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "primary" ? styles.labelPrimary : styles.labelOther,
            variant === "quiet" && styles.labelQuiet,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: theme.spacing(2),
  },
  primary: { backgroundColor: theme.colors.accent },
  secondary: {
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.borderHairline,
  },
  quiet: { backgroundColor: "transparent", minHeight: 40 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  label: { fontSize: 16, fontWeight: "600" },
  labelPrimary: { color: theme.colors.accentContrast },
  labelOther: { color: theme.colors.textPrimary },
  labelQuiet: { color: theme.colors.textSecondary, fontWeight: "500" },
});
