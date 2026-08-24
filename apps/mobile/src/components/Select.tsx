import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "@/lib/theme";

export type Option = { value: string; label: string };

/**
 * Searchable single-select. Long lists (countries) need the filter; short ones
 * ignore it. Kept tap-only so it stays usable without gestures.
 */
export function Select({
  label,
  options,
  value,
  onChange,
  error,
  searchable = false,
  placeholder = "Select",
}: {
  label: string;
  options: readonly Option[];
  value: string | null;
  onChange: (value: string) => void;
  error?: string | null;
  searchable?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.value === value);
  const visible = query
    ? options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.control, error ? styles.controlError : null]}
      >
        <Text style={selected ? styles.valueText : styles.placeholderText}>
          {selected?.label ?? placeholder}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button">
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          {searchable ? (
            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={theme.colors.textSecondary}
              autoCorrect={false}
            />
          ) : null}

          <FlatList
            data={visible}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                accessibilityRole="button"
                onPress={() => {
                  onChange(item.value);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <Text style={styles.rowText}>{item.label}</Text>
                {item.value === value ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" },
  control: {
    borderWidth: 1,
    borderColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: 12,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1.75),
    minHeight: 48,
    justifyContent: "center",
  },
  controlError: { borderColor: theme.colors.danger },
  valueText: { color: theme.colors.textPrimary, fontSize: 16 },
  placeholderText: { color: theme.colors.textSecondary, fontSize: 16 },
  error: { color: theme.colors.danger, fontSize: 13 },
  sheet: { flex: 1, backgroundColor: theme.colors.surfaceBase, paddingTop: theme.spacing(6) },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing(3),
    paddingBottom: theme.spacing(1.5),
  },
  sheetTitle: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" },
  close: { color: theme.colors.accent, fontSize: 16 },
  search: {
    marginHorizontal: theme.spacing(3),
    marginBottom: theme.spacing(1),
    borderWidth: 1,
    borderColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: 10,
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(1.25),
    color: theme.colors.textPrimary,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1.75),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderHairline,
  },
  rowText: { color: theme.colors.textPrimary, fontSize: 16, flex: 1 },
  check: { color: theme.colors.accent, fontSize: 16 },
});
