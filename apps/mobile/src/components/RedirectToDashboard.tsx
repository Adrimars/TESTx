import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/lib/theme";

/**
 * The "nothing left to do here" hop, used wherever a screen determines there is no test
 * left to offer - the Tests tab finding nothing on entry, and the deck finding nothing
 * next after finishing one.
 *
 * Deliberately not a screen of its own: Dashboard already renders an inline "nothing to
 * answer right now" card off the same eligibility check, so it is the one place that
 * actually tells the evaluator what happened. This is only the redirect, shown for the
 * instant it takes `router.replace` to land - a spinner rather than a repeated message
 * that would just say the same thing a moment before Dashboard does anyway.
 */
export function RedirectToDashboard() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

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
