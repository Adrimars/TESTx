import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/lib/session";
import { theme } from "@/lib/theme";

/**
 * The account-level danger zone (16.4), split out of `profile.tsx` - Sign out and Delete
 * account no longer sit under a screen about demographic fields, and this tab is now the
 * natural home for anything else account-level added later (app version, legal doc links).
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useSession();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  function handleDeleteAccount() {
    Alert.alert(
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
                Alert.alert(
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
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Settings</Text>

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
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700" },
  dangerZone: { marginTop: theme.spacing(2), gap: theme.spacing(1) },
  dangerNote: { color: theme.colors.textSecondary, fontSize: 12, textAlign: "center" },
});
