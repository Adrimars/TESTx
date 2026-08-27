import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { FirstTestWalkthrough } from "@/components/FirstTestWalkthrough";
import { RedirectToDashboard } from "@/components/RedirectToDashboard";
import { TestDeck } from "@/components/feed/TestDeck";
import { useSession } from "@/lib/session";
import { useInProgressTest } from "@/lib/submissionQueue";
import { useEvaluatorTest, useNextTest } from "@/lib/test";
import { theme } from "@/lib/theme";
import { useFirstTestWalkthrough } from "@/lib/tutorial";

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useSession();
  // An explicit testId opens that test instead of whatever is next in line - the seam a
  // deep link, or the home screen's "Start test" button, uses to open one directly.
  const { testId: routeTestId } = useLocalSearchParams<{ testId?: string }>();
  const [testId, setTestId] = useState<string | undefined>(routeTestId);
  const nextTest = useNextTest();

  // No explicit test was requested - fall in behind whatever the feed decides is next,
  // the same auto-assignment `/evaluator/next-test` was built for.
  useEffect(() => {
    if (!testId && nextTest.data?.id) setTestId(nextTest.data.id);
  }, [testId, nextTest.data]);

  const test = useEvaluatorTest(testId);
  // A test finished-but-abandoned answer set (11.4) - only ever offered back when it
  // matches the test actually being opened, never a leftover from a different one.
  const inProgress = useInProgressTest(user?.id, testId);

  // Mounted here rather than in TestDeck: TestDeck is keyed per test and remounts on
  // every continue in the feed (see its own doc), which would replay the walkthrough at
  // the first test-to-test transition. This screen is the stable seam the evaluator
  // actually lands on once, before any test - real or loading - is visible underneath.
  const walkthrough = useFirstTestWalkthrough();

  let content: React.ReactNode;

  if (
    (!testId && nextTest.isPending) ||
    (Boolean(testId) && (test.isPending || inProgress.isPending))
  ) {
    content = (
      <Shell>
        <ActivityIndicator color={theme.colors.textSecondary} />
      </Shell>
    );
  } else if ((!testId && nextTest.isError) || test.isError) {
    content = (
      <Shell>
        <Text style={styles.title}>Could not load a test</Text>
        <Text style={styles.subtitle}>
          {(nextTest.error ?? test.error)?.message ?? "Something went wrong."}
        </Text>
        <Button
          label="Try again"
          onPress={() => {
            void nextTest.refetch();
            void test.refetch();
          }}
        />
      </Shell>
    );
  } else if (!test.data) {
    // Silent redirect, same reasoning as TestDeck's own empty phase (RedirectToDashboard's
    // doc): Dashboard's own eligibility check renders the "nothing to answer" message,
    // so this is only the hop back to it, not a second screen saying the same thing.
    content = <RedirectToDashboard />;
  } else {
    content = (
      <TestDeck
        key={testId}
        test={test.data}
        resumedFrom={inProgress.data ?? undefined}
        onContinue={setTestId}
      />
    );
  }

  return (
    <>
      {content}
      {walkthrough.shouldShow ? (
        <FirstTestWalkthrough onComplete={walkthrough.complete} onSkip={walkthrough.skip} />
      ) : null}
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.centered}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.surfaceBase },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(3),
    gap: theme.spacing(1.5),
  },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700", textAlign: "center" },
  subtitle: { color: theme.colors.textSecondary, fontSize: 15, textAlign: "center" },
});
