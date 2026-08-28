import { useEffect } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Flame, TrendingUp } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/lib/session";
import { Button } from "@/components/Button";
import { useBalance, useEvaluatorStats, prefetchNextTest, type EvaluatorStats } from "@/lib/test";
import { theme } from "@/lib/theme";

/**
 * The app's landing tab: balance and activity stats, nothing else.
 *
 * No longer where a test is started (that moved to the Tests tab, a launcher rather than
 * a screen - see (tabs)/_layout.tsx) - and no longer where "nothing to answer right now"
 * gets said either. That message now belongs entirely to the Tests tab's own pre-check
 * (an alert, staying put), so Dashboard doesn't need its own copy of the same eligibility
 * state just to repeat it a second way.
 */
export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useSession();
  const balance = useBalance();
  const stats = useEvaluatorStats();
  const queryClient = useQueryClient();

  const missingProfileFields = getMissingOptionalProfileFields(user);

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

        {stats.data ? (
          <>
            <View style={styles.statRow}>
              <StatTile
                Icon={CircleCheck}
                value={stats.data.totalCompleted}
                label="Tests completed"
              />
              <StatTile
                Icon={TrendingUp}
                value={stats.data.completedThisWeek}
                label="This week"
              />
              <StatTile Icon={Flame} value={stats.data.currentStreakDays} label="Day streak" />
            </View>

            <PointsSparkline pointsByDay={stats.data.pointsByDay} />

            {missingProfileFields.length > 0 ? (
              <View style={styles.nudgeCard}>
                <Text style={styles.nudgeTitle}>Finish your profile</Text>
                <Text style={styles.nudgeBody}>
                  {missingProfileFields.join(", ")} still {missingProfileFields.length === 1 ? "isn't" : "aren't"} filled
                  in - it helps match you to more tests.
                </Text>
                <Button
                  label="Go to Profile"
                  variant="secondary"
                  onPress={() => router.push("/profile")}
                />
              </View>
            ) : null}

            {stats.data.recentActivity.length > 0 ? (
              <View style={styles.activitySection}>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                {stats.data.recentActivity.map((entry) => (
                  <View key={entry.testId} style={styles.activityRow}>
                    <View style={styles.activityText}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {entry.title}
                      </Text>
                      <Text style={styles.activityDate}>{formatRelativeDate(entry.completedAt)}</Text>
                    </View>
                    <Text style={styles.activityPoints}>
                      {entry.isFlagged ? "Flagged" : `+${entry.pointsEarned}`}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : stats.isPending ? (
          <ActivityIndicator color={theme.colors.textSecondary} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type StatIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function StatTile({ Icon, value, label }: { Icon: StatIcon; value: number; label: string }) {
  return (
    <View style={styles.statTile}>
      <Icon size={18} color={theme.colors.accent} strokeWidth={1.75} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const SPARKLINE_MAX_BAR_HEIGHT = 40;
const SPARKLINE_MIN_BAR_HEIGHT = 3;

/** A day-by-day points bar chart built from plain Views, matching ProgressBar's own
 * approach (apps/mobile/src/components/feed/ProgressBar.tsx) rather than pulling in a
 * charting library for one sparkline. */
function PointsSparkline({ pointsByDay }: { pointsByDay: EvaluatorStats["pointsByDay"] }) {
  const maxPoints = Math.max(1, ...pointsByDay.map((d) => d.points));

  return (
    <View style={styles.sparklineCard}>
      <Text style={styles.sectionTitle}>Points, last 14 days</Text>
      <View style={styles.sparklineRow}>
        {pointsByDay.map((day) => {
          const height = Math.max(
            SPARKLINE_MIN_BAR_HEIGHT,
            (day.points / maxPoints) * SPARKLINE_MAX_BAR_HEIGHT
          );
          return (
            <View key={day.date} style={styles.sparklineBarTrack}>
              <View
                style={[
                  styles.sparklineBar,
                  { height, opacity: day.points > 0 ? 1 : 0.35 },
                ]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Simple day-bucket phrasing, no Intl.RelativeTimeFormat - Hermes's ICU data for it is
 * not reliably present on every Android build, and getting this wrong reads as a bug on
 * every card, not just an edge case. */
function formatRelativeDate(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfThen.getTime()) / (24 * 60 * 60 * 1000));

  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return `${dayDiff} days ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type OptionalStringProfileField =
  | "city"
  | "nativeLanguage"
  | "occupation"
  | "educationLevel"
  | "aiExperience"
  | "aiFrequency";

const OPTIONAL_PROFILE_LABELS: { key: OptionalStringProfileField; label: string }[] = [
  { key: "city", label: "City" },
  { key: "nativeLanguage", label: "Native language" },
  { key: "occupation", label: "Occupation" },
  { key: "educationLevel", label: "Education level" },
  { key: "aiExperience", label: "AI experience" },
  { key: "aiFrequency", label: "AI frequency" },
];

/** Optional profile fields still empty, for the completeness nudge - required fields
 * (age/gender/country) can't be missing by the time Dashboard is reachable at all. */
function getMissingOptionalProfileFields(
  user: ReturnType<typeof useSession>["user"]
): string[] {
  const profile = user?.evaluatorProfile;
  if (!profile) return [];
  const missing: string[] = [];
  for (const field of OPTIONAL_PROFILE_LABELS) {
    if (!profile[field.key]) missing.push(field.label);
  }
  if (profile.hobbies.length === 0) missing.push("Hobbies");
  return missing;
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
  statRow: { flexDirection: "row", gap: theme.spacing(1.25) },
  statTile: {
    flex: 1,
    gap: 4,
    alignItems: "center",
    padding: theme.spacing(1.5),
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
  },
  statValue: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: "800" },
  statLabel: { color: theme.colors.textSecondary, fontSize: 11, textAlign: "center" },
  sparklineCard: {
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
  },
  sectionTitle: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "700" },
  sparklineRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: SPARKLINE_MAX_BAR_HEIGHT,
  },
  sparklineBarTrack: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  sparklineBar: {
    width: "60%",
    borderRadius: 3,
    backgroundColor: theme.colors.accent,
  },
  nudgeCard: {
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
  },
  nudgeTitle: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: "700" },
  nudgeBody: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18 },
  activitySection: { gap: theme.spacing(1) },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
  },
  activityText: { flex: 1, gap: 2 },
  activityTitle: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" },
  activityDate: { color: theme.colors.textSecondary, fontSize: 12 },
  activityPoints: { color: theme.colors.accent, fontSize: 14, fontWeight: "700" },
});
