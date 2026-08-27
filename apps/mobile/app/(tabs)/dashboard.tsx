import { useEffect } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { Button } from "@/components/Button";
import { useAvailableTests, useBalance, prefetchNextTest } from "@/lib/test";
import { theme } from "@/lib/theme";

/**
 * The app's landing tab.
 *
 * No longer where a test is started (that moved to the Tests tab, a launcher rather than
 * a screen - see (tabs)/_layout.tsx) - this is balance plus status. Eligibility is still
 * checked here, off the same query the Tests tab's own empty-state redirect lands back
 * on: whichever of them determines there is nothing to answer, this is the one place that
 * actually renders that message, so it has to stay accurate regardless of which one asked.
 */
export default function DashboardScreen() {
  const { user } = useSession();
  const tests = useAvailableTests();
  const balance = useBalance();
  const queryClient = useQueryClient();

  const hasEligibleTest = Boolean(tests.data && tests.data.length > 0);

  // Warms the Tests tab's launch query ahead of time (see prefetchNextTest's own doc) -
  // Dashboard is the landing tab on every cold start and after every sign-in, so by the
  // time anyone actually taps Tests, this has almost always already resolved.
  useEffect(() => {
    void prefetchNextTest(queryClient);
  }, [queryClient]);

  return (
    <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerText}>
          <Image
            source={require("../../assets/images/testx-logo.png")}
            style={styles.greeting}
            resizeMode="contain"
          />
          <Text style={styles.email} numberOfLines={1}>
            {user?.email ?? ""}
          </Text>
        </View>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your balance</Text>
          {balance.isPending ? (
            <ActivityIndicator color={theme.colors.textSecondary} />
          ) : (
            <Text style={styles.balanceValue}>
              {balance.data?.balance ?? 0} <Text style={styles.balanceUnit}>points</Text>
            </Text>
          )}
        </View>

        <View style={styles.startSection}>
          {tests.isPending ? (
            <ActivityIndicator color={theme.colors.textSecondary} />
          ) : tests.isError ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Could not load tests</Text>
              <Text style={styles.stateBody}>{tests.error.message}</Text>
              <Button label="Try again" variant="secondary" onPress={() => void tests.refetch()} />
            </View>
          ) : !hasEligibleTest ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Nothing to answer right now</Text>
              <Text style={styles.stateBody}>
                New tests appear here as they open. Check back later.
              </Text>
            </View>
          ) : (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Tests are waiting for you</Text>
              <Text style={styles.stateBody}>Open the Tests tab below to start answering.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  content: { padding: theme.spacing(2.5), gap: theme.spacing(2) },
  headerText: { gap: 2 },
  greeting: { width: 110, height: 30 },
  email: { color: theme.colors.textSecondary, fontSize: 13 },
  balanceCard: {
    gap: theme.spacing(0.5),
    padding: theme.spacing(2),
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
  },
  balanceLabel: { color: theme.colors.accentContrast, fontSize: 13, opacity: 0.85 },
  balanceValue: { color: theme.colors.accentContrast, fontSize: 32, fontWeight: "800" },
  balanceUnit: { fontSize: 15, fontWeight: "600" },
  startSection: { marginTop: theme.spacing(1) },
  stateCard: {
    gap: theme.spacing(1),
    padding: theme.spacing(2.5),
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
  },
  stateTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "600" },
  stateBody: { color: theme.colors.textSecondary, fontSize: 14, textAlign: "center" },
});
