import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { useSession } from "@/lib/session";
import { useAvailableTests, useBalance } from "@/lib/test";
import { theme } from "@/lib/theme";

/**
 * The app's landing tab (16.4/16.5).
 *
 * No longer a list to pick from (prd.md §15.4 already specified this; the old `home.tsx`
 * contradicted it) - just the balance and one Start button. Eligibility is checked here,
 * before ever entering the feed, so "nothing available" reads as this tab's own inline
 * empty state rather than a flash of the feed screen's matching one.
 */
export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useSession();
  const tests = useAvailableTests();
  const balance = useBalance();

  const hasEligibleTest = Boolean(tests.data && tests.data.length > 0);

  return (
    <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>TESTx</Text>
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
            <Button label="Start" onPress={() => router.push("/feed")} />
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
  greeting: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: "700", letterSpacing: 0.5 },
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
