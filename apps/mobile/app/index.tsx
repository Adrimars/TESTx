import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { getAccessToken } from "@/lib/tokens";
import { theme } from "@/lib/theme";

/**
 * Auth-check splash: decides between the entry screen and the feed before any
 * other screen renders. Phase 9.3 replaces the token presence check with a
 * real session lookup.
 */
export default function SplashScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const token = await getAccessToken();
      if (cancelled) return;
      setChecking(false);
      router.replace(token ? "/feed" : "/login");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.wordmark}>TESTx</Text>
      {checking ? <ActivityIndicator color={theme.colors.accent} /> : null}
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
