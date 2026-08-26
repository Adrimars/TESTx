import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { useSession } from "@/lib/session";
import { useAvailableTests, useBalance } from "@/lib/test";
import type { AvailableTest } from "@/lib/test";
import { theme } from "@/lib/theme";

/**
 * The app's landing screen.
 *
 * Deliberately not the test itself. Dropping someone straight into a question the moment
 * they open the app gives them no idea what they are being asked, what it pays, or how
 * long it runs - and a test started by accident is exactly the careless-answer problem
 * the quality checks then punish them for.
 */
export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut } = useSession();
  const tests = useAvailableTests();
  const balance = useBalance();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>TESTx</Text>
            <Text style={styles.email} numberOfLines={1}>
              {user?.email ?? ""}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open your profile"
            onPress={() => router.push("/profile")}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          >
            <Text style={styles.avatarGlyph}>{(user?.email ?? "?").slice(0, 1).toUpperCase()}</Text>
          </Pressable>
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

        <Text style={styles.sectionTitle}>Available now</Text>

        {tests.isPending ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={theme.colors.textSecondary} />
          </View>
        ) : tests.isError ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Could not load tests</Text>
            <Text style={styles.stateBody}>{tests.error.message}</Text>
            <Button label="Try again" variant="secondary" onPress={() => void tests.refetch()} />
          </View>
        ) : !tests.data || tests.data.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Nothing to answer right now</Text>
            <Text style={styles.stateBody}>
              New tests appear here as they open. Check back later.
            </Text>
          </View>
        ) : (
          tests.data.map((test) => (
            <TestCard
              key={test.id}
              test={test}
              onStart={() => router.push(`/feed?testId=${test.id}`)}
            />
          ))
        )}

        <View style={styles.footer}>
          <Button label="Rewards" variant="secondary" onPress={() => router.push("/rewards")} />
          <Button label="Profile" variant="secondary" onPress={() => router.push("/profile")} />
          <Button label="Sign out" variant="quiet" onPress={handleSignOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TestCard({ test, onStart }: { test: AvailableTest; onStart: () => void }) {
  return (
    <View style={styles.testCard}>
      <Text style={styles.testTitle}>{test.title}</Text>
      {test.description ? <Text style={styles.testDescription}>{test.description}</Text> : null}
      <View style={styles.metaRow}>
        <Meta label="Questions" value={String(test.questionCount)} />
        <Meta label="Reward" value={`${test.rewardPoints} pts`} />
        {test.advisoryTimeMin ? <Meta label="Time" value={`~${test.advisoryTimeMin} min`} /> : null}
      </View>
      <Button label="Start test" onPress={onStart} />
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaValue}>{value}</Text>
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  content: { padding: theme.spacing(2.5), gap: theme.spacing(2) },
  headerRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing(2) },
  headerText: { flex: 1, gap: 2 },
  greeting: { color: theme.colors.textPrimary, fontSize: 26, fontWeight: "700", letterSpacing: 0.5 },
  email: { color: theme.colors.textSecondary, fontSize: 13 },
  avatar: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.borderHairline,
  },
  avatarGlyph: { color: theme.colors.textPrimary, fontSize: 17, fontWeight: "700" },
  pressed: { opacity: 0.75 },
  balanceCard: {
    gap: theme.spacing(0.5),
    padding: theme.spacing(2),
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
  },
  balanceLabel: { color: theme.colors.accentContrast, fontSize: 13, opacity: 0.85 },
  balanceValue: { color: theme.colors.accentContrast, fontSize: 32, fontWeight: "800" },
  balanceUnit: { fontSize: 15, fontWeight: "600" },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
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
  testCard: {
    gap: theme.spacing(1.5),
    padding: theme.spacing(2.5),
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
  },
  testTitle: { color: theme.colors.textPrimary, fontSize: 19, fontWeight: "700", lineHeight: 25 },
  testDescription: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
  metaRow: { flexDirection: "row", gap: theme.spacing(3), paddingVertical: theme.spacing(0.5) },
  meta: { gap: 2 },
  metaValue: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" },
  metaLabel: { color: theme.colors.textSecondary, fontSize: 12 },
  footer: { gap: theme.spacing(1), marginTop: theme.spacing(1) },
});
