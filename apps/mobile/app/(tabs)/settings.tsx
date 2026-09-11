import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { alert } from "@/lib/alert";
import { apiFetch } from "@/lib/api";
import {
  isPushPermissionGranted,
  registerForPushNotificationsAsync,
  unregisterPushNotifications,
} from "@/lib/pushNotifications";
import { DESKTOP_FORM_MAX_WIDTH, useIsDesktopWeb } from "@/lib/responsive";
import { useSession } from "@/lib/session";
import { theme } from "@/lib/theme";

/**
 * The account-level danger zone (16.4), split out of `profile.tsx` - Sign out and Delete
 * account no longer sit under a screen about demographic fields, and this tab is now the
 * natural home for anything else account-level added later (app version, legal doc links).
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useSession();
  const isDesktopWeb = useIsDesktopWeb();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    void isPushPermissionGranted().then(setPushEnabled);
  }, []);

  async function handleTogglePush(next: boolean) {
    if (!user || pushBusy) return;
    setPushBusy(true);
    try {
      if (next) {
        await registerForPushNotificationsAsync(user.id);
        const granted = await isPushPermissionGranted();
        setPushEnabled(granted);
        if (!granted) {
          alert(
            "Notifications are off",
            "Notifications are blocked for TESTx. Turn them on from your device's system settings to enable them here."
          );
        }
      } else {
        // 21.5: turning the toggle off clears the stored PushSubscription, same as
        // signing out (handleSignOut below) - both are "this device should stop getting
        // notified", just from different triggers.
        await unregisterPushNotifications();
        setPushEnabled(false);
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function handleDeleteAccount() {
    alert(
      "Delete account?",
      "This permanently deletes your account, your profile and your answer history. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await apiFetch("/users/me", { method: "DELETE" });
                await signOut();
                router.replace("/login");
              } catch (error) {
                alert(
                  "Could not delete account",
                  error instanceof Error ? error.message : "Please try again."
                );
              }
            })();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={[styles.container, isDesktopWeb && styles.containerDesktop]}
      >
        <Text style={styles.title}>Settings</Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Push notifications</Text>
            <Text style={styles.rowNote}>New tests and reminders when tests are waiting for you.</Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={(next) => void handleTogglePush(next)}
            disabled={pushBusy}
            trackColor={{ false: theme.colors.borderHairline, true: theme.colors.accent }}
            thumbColor={theme.colors.textPrimary}
          />
        </View>

        <View style={styles.dangerZone}>
          <Button label="Sign out" variant="secondary" onPress={handleSignOut} />
          <Button label="Delete account" variant="quiet" onPress={handleDeleteAccount} />
          <Text style={styles.dangerNote}>
            Deleting your account removes your profile and answer history permanently.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  container: { padding: theme.spacing(3), gap: theme.spacing(2) },
  // Settings is a short list of buttons - left at the tabs group's full ~1040px width it
  // reads as mostly empty page rather than a deliberately compact screen, so this caps it
  // to a narrower, centered column of its own instead.
  containerDesktop: { maxWidth: DESKTOP_FORM_MAX_WIDTH, width: "100%", alignSelf: "center" },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: 16,
    padding: theme.spacing(2),
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: "600" },
  rowNote: { color: theme.colors.textSecondary, fontSize: 12 },
  dangerZone: { marginTop: theme.spacing(2), gap: theme.spacing(1) },
  dangerNote: { color: theme.colors.textSecondary, fontSize: 12, textAlign: "center" },
});
