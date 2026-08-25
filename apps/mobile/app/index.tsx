import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "@/lib/session";
import { theme } from "@/lib/theme";

/**
 * Auth-check splash. Routes to the home screen, onboarding or the entry screen
 * once the stored token has been validated against the API.
 */
export default function SplashScreen() {
  const router = useRouter();
  const { initializing, user, hasProfile } = useSession();

  useEffect(() => {
    if (initializing) return;
    if (!user) router.replace("/login");
    else router.replace(hasProfile ? "/home" : "/profile-onboarding");
  }, [initializing, user, hasProfile, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.wordmark}>TESTx</Text>
      <ActivityIndicator color={theme.colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceBase,
    gap: theme.spacing(2),
  },
  wordmark: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 1,
  },
});
