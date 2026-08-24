import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { useSession } from "@/lib/session";
import { theme } from "@/lib/theme";

export default function FeedScreen() {
  const router = useRouter();
  const { user, signOut } = useSession();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.container}>
        <Text style={styles.title}>Feed</Text>
        <Text style={styles.subtitle}>
          The swipeable question feed is built in Phase 10 and Phase 11.
        </Text>
        {user ? <Text style={styles.email}>Signed in as {user.email}</Text> : null}
        <Button label="Sign out" variant="secondary" onPress={handleSignOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3),
    gap: theme.spacing(1.5),
  },
  title: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: "700" },
  subtitle: { color: theme.colors.textSecondary, fontSize: 15, textAlign: "center" },
  email: { color: theme.colors.textSecondary, fontSize: 13, marginBottom: theme.spacing(2) },
});
