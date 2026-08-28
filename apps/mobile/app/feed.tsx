import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Inbox } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { TestDeck } from "@/components/feed/TestDeck";
import { useSession } from "@/lib/session";
import { useInProgressTest } from "@/lib/submissionQueue";
import { useEvaluatorTest, useNextTest } from "@/lib/test";
import { theme } from "@/lib/theme";

export default function FeedScreen() {
  const router = useRouter();
  const { user } = useSession();
  // An explicit testId opens that test instead of whatever is next in line - the seam a
  // deep link uses to open one directly.
  const { testId: routeTestId } = useLocalSearchParams<{ testId?: string }>();
  const [testId, setTestId] = useState<string | undefined>(routeTestId);
  const nextTest = useNextTest();

  // No explicit test was requested - fall in behind whatever the feed decides is next,
  // the same auto-assignment `/evaluator/next-test` was built for.
  useEffect(() => {
    if (!testId && nextTest.data?.id) setTestId(nextTest.data.id);
  }, [testId, nextTest.data]);

  // `testId` only catches up to `nextTest.data.id` a render *after* nextTest resolves -
  // the effect above runs post-commit, not during this render. That lag used to be
  // invisible because nextTest was always still pending on that first render anyway, so
  // the loading branch caught it. Now that Tests-tab prefetches it, nextTest can already
  // be resolved (not pending) on this very first render while `testId` is still
  // undefined - which used to fall straight through every branch below into "no test
  // data, redirect to Dashboard", even though a real test was sitting right there in
  // nextTest.data. Reading nextTest.data.id directly, rather than waiting on the state
  // sync, closes that gap: everything below sees the real id from the first render on.
  const effectiveTestId = testId ?? nextTest.data?.id;

  const test = useEvaluatorTest(effectiveTestId);
  // A test finished-but-abandoned answer set (11.4) - only ever offered back when it
  // matches the test actually being opened, never a leftover from a different one.
  const inProgress = useInProgressTest(user?.id, effectiveTestId);

  let content: React.ReactNode;

  if (
    (!effectiveTestId && nextTest.isPending) ||
    (Boolean(effectiveTestId) && (test.isPending || inProgress.isPending))
  ) {
    content = (
      <Shell>
        <ActivityIndicator color={theme.colors.textSecondary} />
      </Shell>
    );
  } else if ((!effectiveTestId && nextTest.isError) || test.isError) {
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
    // Genuinely nothing: nextTest and (if an id was ever in hand) test have both settled
    // with no data and no error.
    //
    // Said out loud rather than redirected away from. This used to bounce silently back
    // to Dashboard, which gave the evaluator no idea whether they had run out of tests or
    // the Tests tab was simply broken - and it looked identical to a real failure. A
    // named screen with its own retry is the difference between "nothing right now" and
    // "something went wrong", which are the two things they actually need told apart.
    content = (
      <Shell>
        <Inbox size={40} color={theme.colors.accent} strokeWidth={1.5} />
        <Text style={styles.title}>No tests available</Text>
        <Text style={styles.subtitle}>
          There is nothing for you to answer right now. New tests appear as they open -
          please try again later.
        </Text>
        <Button label="Try again" onPress={() => void nextTest.refetch()} />
        <Button
          label="Back to Dashboard"
          variant="quiet"
          onPress={() => router.replace("/dashboard")}
        />
      </Shell>
    );
  } else {
    content = (
      <TestDeck
        key={effectiveTestId}
        test={test.data}
        resumedFrom={inProgress.data ?? undefined}
        onContinue={setTestId}
      />
    );
  }

  return content;
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
