import { StyleSheet, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";
import { theme } from "@/lib/theme";

export function Field({
  label,
  error,
  ...inputProps
}: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        style={[styles.input, error ? styles.inputError : null]}
        placeholderTextColor={theme.colors.textSecondary}
        accessibilityLabel={label}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" },
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
  inputError: { borderColor: theme.colors.danger },
  error: { color: theme.colors.danger, fontSize: 13 },
});
