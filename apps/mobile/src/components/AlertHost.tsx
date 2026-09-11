import { useSyncExternalStore } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import type { AlertButton } from "react-native";
import { Button } from "./Button";
import { dismissAlert, getAlertState, subscribeAlert } from "@/lib/alertStore";
import { theme } from "@/lib/theme";

/**
 * Renders whatever `alert()` (lib/alert.ts) last pushed, as the deck's own "Popup" card
 * (prd.md §16.6) - not the OS's native dialog. Mounted once at the app root
 * (app/_layout.tsx); every call site keeps calling the same `alert()` function, so this is
 * the only file that needed to change to move every alert in the app off native chrome.
 *
 * No backdrop-tap-to-dismiss: a "Delete account?" confirm has no safe default to fall back
 * to on an outside tap, so every alert here is closed by pressing one of its own buttons.
 */
export function AlertHost() {
  const state = useSyncExternalStore(subscribeAlert, getAlertState, getAlertState);

  if (!state) return null;

  const cancelButton = state.buttons.find((button) => button.style === "cancel");

  function press(button: AlertButton) {
    dismissAlert();
    button.onPress?.();
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => press(cancelButton ?? state!.buttons[state!.buttons.length - 1]!)}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{state.title}</Text>
          {state.message ? <Text style={styles.message}>{state.message}</Text> : null}
          <View style={styles.actions}>
            {state.buttons.map((button, index) => (
              <Button
                key={`${button.text ?? "OK"}-${index}`}
                label={button.text ?? "OK"}
                variant={buttonVariant(button)}
                onPress={() => press(button)}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Maps `Alert.alert`'s own button styling vocabulary onto this app's Button variants. */
function buttonVariant(button: AlertButton): "primary" | "secondary" | "quiet" {
  if (button.style === "cancel") return "quiet";
  if (button.style === "destructive") return "secondary";
  return "primary";
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.withAlpha(theme.colors.surfaceBase, 0.72),
    padding: theme.spacing(3),
  },
  card: {
    width: "100%",
    maxWidth: 340,
    gap: theme.spacing(1),
    padding: theme.spacing(3),
    borderRadius: 24,
    // A popup, per prd.md §16.6's component patterns - one step lighter than a card.
    backgroundColor: theme.colors.surfaceOverlay,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
  },
  title: { color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700" },
  message: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 21 },
  actions: { gap: theme.spacing(1), marginTop: theme.spacing(1.5) },
});
