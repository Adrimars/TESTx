import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/lib/theme";

/**
 * The Tests tab's own route content is never actually meant to render. Pressing the tab
 * is intercepted in (tabs)/_layout.tsx, which pushes straight into /feed - the full-screen,
 * chrome-free swipe experience - instead of switching to this screen, so tapping the tab
 * feels like opening a card deck directly rather than opening a tab that then has a button.
 *
 * This file exists as the fallback for the one path that skips that interception: a
 * restored navigation state (e.g. Android recreating the app after it was killed) can put
 * this tab's route back on screen directly. If that happens, it does the same thing the
 * interceptor would have.
 */
export default function TestsTabScreen() {
  useEffect(() => {
    router.replace("/feed");
  }, []);

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.textSecondary} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
});
