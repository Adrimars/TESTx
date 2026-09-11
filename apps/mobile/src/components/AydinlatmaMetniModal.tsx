import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { AydinlatmaMetniBody } from "./AydinlatmaMetniBody";
import { Button } from "./Button";
import { theme } from "@/lib/theme";

/**
 * Full disclosure text as a modal, opened from the registration checkbox
 * (register.tsx) instead of navigating to a separate screen. Only the confirm
 * button here may check that checkbox - dismissing any other way (Kapat, the
 * hardware back button) leaves it unchecked, so checking it always means the text
 * was actually shown.
 */
export function AydinlatmaMetniModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <AydinlatmaMetniBody />
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Okundu, onaylandi" onPress={onConfirm} />
          <Button label="Kapat" variant="quiet" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  scroll: { padding: theme.spacing(3), gap: theme.spacing(2), paddingBottom: theme.spacing(4) },
  footer: {
    padding: theme.spacing(3),
    gap: theme.spacing(1),
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceBase,
  },
});
