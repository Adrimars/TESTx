import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AVATARS } from "@/lib/avatars";
import { theme } from "@/lib/theme";

export function AvatarPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (avatarId: number) => void;
}) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Avatar</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {AVATARS.map((source, index) => {
          const selected = value === index;
          return (
            <Pressable
              key={index}
              onPress={() => onChange(index)}
              accessibilityRole="button"
              accessibilityLabel={`Avatar ${index + 1}`}
              accessibilityState={{ selected }}
              style={[styles.item, selected && styles.itemSelected]}
            >
              <Image source={source} style={styles.image} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  label: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" },
  row: { gap: theme.spacing(1.5), paddingVertical: 4 },
  item: {
    borderRadius: 999,
    borderWidth: 3,
    borderColor: "transparent",
    padding: 2,
  },
  itemSelected: { borderColor: theme.colors.accent },
  image: { width: 64, height: 64, borderRadius: 999 },
});
