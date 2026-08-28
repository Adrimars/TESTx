import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { theme } from "@/lib/theme";

/**
 * `secureTextEntry` is what marks a `Field` as a password field - passing it turns on the
 * eye-icon show/hide toggle (16.8) automatically, so every password field in the app (both
 * on register.tsx, the one on login.tsx) gets identical behaviour for free rather than each
 * screen wiring its own visibility state.
 */
export function Field({
  label,
  error,
  secureTextEntry,
  ...inputProps
}: TextInputProps & { label: string; error?: string | null }) {
  const [visible, setVisible] = useState(false);
  const isPassword = secureTextEntry === true;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          {...inputProps}
          secureTextEntry={isPassword ? !visible : secureTextEntry}
          style={[styles.input, isPassword && styles.inputWithToggle, error ? styles.inputError : null]}
          placeholderTextColor={theme.colors.textSecondary}
          accessibilityLabel={label}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            onPress={() => setVisible((prev) => !prev)}
            style={styles.toggle}
          >
            {visible ? (
              <EyeOff size={20} color={theme.colors.textSecondary} strokeWidth={1.5} />
            ) : (
              <Eye size={20} color={theme.colors.textSecondary} strokeWidth={1.5} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" },
  inputRow: { justifyContent: "center" },
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
  // Room for the toggle icon so typed text never runs under it.
  inputWithToggle: { paddingRight: theme.spacing(6) },
  inputError: { borderColor: theme.colors.danger },
  // 44pt minimum touch target (prd.md §16.7), centred on the field regardless of its
  // height rather than pinned to a fixed offset from the top.
  toggle: {
    position: "absolute",
    right: 2,
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  error: { color: theme.colors.danger, fontSize: 13 },
});
