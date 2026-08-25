import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { CardStack } from "@/components/cards/CardStack";
import { QuestionCard } from "@/components/cards/QuestionCard";
import { ApiError } from "@/lib/api";
import { useDeck } from "@/lib/deck";
import { resolveMediaUrl } from "@/lib/env";
import { useSession } from "@/lib/session";
import {
  clearInProgressTest,
  prefetchInProgressTest,
  submitWithBackoff,
  writeInProgressTest,
  writePendingSubmission,
  type InProgressTest,
} from "@/lib/submissionQueue";
import {
  prefetchAvailableTests,
  prefetchTest,
  type EvaluatorTest,
  type SubmitResult,
} from "@/lib/test";
import { theme } from "@/lib/theme";
import { ProgressBar } from "./ProgressBar";

/** Fire the background next-test lookup with this many questions left to answer. */
const PREFETCH_WINDOW = 2;

/**
 * A test the eligible list just offered can still turn out unopenable by the time the
 * full fetch runs (capacity filled, eligibility changed) - these are the codes that mean
 * "not this one", not "something is broken". The list is re-fetched fresh on every
 * attempt, so trying the next candidate is a real retry, not a repeat of the same answer.
 */
const UNAVAILABLE_NEXT_CODES = new Set(["NOT_AVAILABLE", "CAPACITY_REACHED", "NOT_ELIGIBLE", "NOT_FOUND"]);
const MAX_NEXT_TEST_ATTEMPTS = 3;

/**
 * Finds a test the feed can actually open next, skipping past ones that just fell
 * through - and past `currentTestId` itself. The current test has no `TestResponse` row
 * until its submit lands, so it's still "eligible" by every filter the server applies;
 * without excluding it here, the prefetch finds the test the evaluator is *already* on,
 * `onContinue` becomes a same-id `setState` that React drops, and the feed hangs on a
 * spinner instead of continuing.
 */
async function findNextTest(queryClient: QueryClient, currentTestId: string): Promise<string | null> {
  const exclude = new Set([currentTestId]);

  for (let attempt = 0; attempt < MAX_NEXT_TEST_ATTEMPTS; attempt += 1) {
    const candidates = await prefetchAvailableTests(queryClient);
    const next = candidates.find((candidate) => !exclude.has(candidate.id));
    if (!next) return null;

    try {
      // The in-progress lookup is primed here too, not just the test itself - both are
      // what `feed.tsx` gates its loading spinner on, so both need to be a cache hit by
      // the time `onContinue` swaps `key={testId}` or the gap just moves one gate later.
      const [full] = await Promise.all([
        prefetchTest(queryClient, next.id),
        prefetchInProgressTest(queryClient, next.id),
      ]);
      prefetchFirstCardMedia(full);
      return next.id;
    } catch (error) {
      if (error instanceof ApiError && UNAVAILABLE_NEXT_CODES.has(error.code ?? "")) {
        exclude.add(next.id);
        continue;
      }
      return null;
    }
  }
  return null;
}

type Phase =
  | "answering"
  | "submitting"
  | "popup"
  | "pendingSync"
  | "checkingNext"
  | "empty"
  | "error";

type TestDeckProps = {
  test: EvaluatorTest;
  /** A persisted in-progress answer set for this exact test, if a kill left one behind. */
  resumedFrom?: InProgressTest;
  /** Opens the next test in the same feed, with no navigation and no loading gap. */
  onContinue: (nextTestId: string) => void;
};

/**
 * Owns one test's whole life in the continuous feed: the card deck, the progress bar,
 * the background prefetch of whatever comes next, and the end-of-test submit/reward.
 *
 * Keyed by test id in `feed.tsx` (`key={testId}`), so a new test gets a clean `useDeck`
 * instead of one carrying over the previous test's index and answers - the deck-cursor
 * bug that would otherwise show on every test-to-test transition.
 */
export function TestDeck({ test, resumedFrom, onContinue }: TestDeckProps) {
  const router = useRouter();
  const { signOut } = useSession();
  const queryClient = useQueryClient();
  const deck = useDeck(test.questions, resumedFrom);

  // The token that anchors this test's `startedAt` for the quality service's timing
  // checks. A resumed test keeps the token minted *before* the kill, not the fresh one
  // `test` was just refetched with - the fresh one's `startedAt` is the resume moment,
  // which would make a nearly-finished test look like it was answered in secondsflat and
  // fail the speed check for real, honest work. See submissionQueue.ts / plan.md 11.4.
  const sessionToken = resumedFrom?.sessionToken ?? test.sessionToken;

  const [phase, setPhase] = useState<Phase>("answering");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const questionCount = test.questions.length;
  const remaining = questionCount - deck.index;

  // Resolves to the next test's id once prefetched, or null once we know there is none.
  // Kept as a promise (not just state) so `advance()` can await an in-flight prefetch
  // instead of racing it - the deck can reach its last card before the background
  // lookup started a moment earlier has actually resolved.
  const prefetchRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    if (prefetchRef.current || remaining > PREFETCH_WINDOW || remaining <= 0) return;
    prefetchRef.current = findNextTest(queryClient, test.id);
  }, [remaining, queryClient, test.id]);

  // Persists the in-progress answers map as the evaluator moves through the deck (11.4),
  // so a killed app resumes an almost-finished test instead of losing it. Stops the
  // moment the deck completes - from there the finished-but-unconfirmed payload below is
  // the thing worth protecting, not the now-superseded in-progress record.
  useEffect(() => {
    if (deck.isComplete) return;
    void writeInProgressTest({
      testId: test.id,
      sessionToken,
      index: deck.index,
      answers: deck.answers,
      canGoBack: deck.canGoBack,
    });
  }, [test.id, sessionToken, deck.index, deck.answers, deck.canGoBack, deck.isComplete]);

  useEffect(() => {
    if (!deck.isComplete || phase !== "answering") return;
    setPhase("submitting");

    // Every question gets an entry, even one the deck somehow never answered - the API
    // rejects a submission with a question missing (`INCOMPLETE`) rather than silently
    // accepting a partial one.
    const answers = test.questions.map(
      (question) =>
        deck.answers[question.id] ?? {
          questionId: question.id,
          selectedOptionIds: [],
          timeSpentSeconds: 0,
        }
    );
    const payload = { testId: test.id, sessionToken, answers };

    void (async () => {
      // The test is finished; what needs protecting from here on is this payload, not
      // the answers-in-progress record it has just replaced. Written before the backoff
      // loop even starts, so a kill mid-retry still has it queued for next launch.
      await clearInProgressTest();
      await writePendingSubmission(payload);
      const outcome = await submitWithBackoff(queryClient, payload);

      switch (outcome.status) {
        case "success":
          setResult(outcome.result);
          setPhase("popup");
          break;
        case "settled":
          // The test is decided one way or another already (submitted, paused, closed,
          // full) - nothing here is fixed by showing an error, so just move on.
          setResult(null);
          void advance();
          break;
        case "rejected":
          setErrorMessage(outcome.message);
          setPhase("error");
          break;
        case "pending":
          // Backoff exhausted on network failures alone. The payload stays queued on
          // device and gets one more attempt on next launch (`retryPendingSubmissionOnce`
          // in _layout.tsx) - showing a fake success now would risk the flagged-zero-
          // points outcome this whole path exists to avoid.
          setPhase("pendingSync");
          break;
      }
    })();
  }, [deck.isComplete, phase]);

  /** Moves the feed into whatever test comes next, or ends it. */
  async function advance() {
    setPhase("checkingNext");
    const nextId = await (prefetchRef.current ?? findNextTest(queryClient, test.id));

    if (nextId) {
      onContinue(nextId);
    } else {
      setPhase("empty");
    }
  }

  function retrySubmit() {
    setErrorMessage(null);
    setPhase("answering");
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  if (phase === "empty") {
    return (
      <Shell>
        <Text style={styles.title}>Nothing to answer right now</Text>
        <Text style={styles.subtitle}>New tests show up here as they open.</Text>
        <Button label="Profile" variant="secondary" onPress={() => router.push("/profile")} />
        <Button label="Sign out" variant="quiet" onPress={handleSignOut} />
      </Shell>
    );
  }

  if (phase === "error") {
    // `rejected` only reaches here for a definitively bad payload or session
    // (INVALID_SESSION / INVALID_ANSWER / INCOMPLETE) - retrying would resubmit the
    // identical thing and fail identically, so the only real way forward is back to the
    // feed for a fresh test, not a "Try again" that can never succeed.
    return (
      <Shell>
        <Text style={styles.title}>Could not submit your answers</Text>
        <Text style={styles.subtitle}>{errorMessage ?? "Something went wrong."}</Text>
        <Button label="Back to tests" onPress={() => router.replace("/home")} />
        <Button label="Sign out" variant="quiet" onPress={handleSignOut} />
      </Shell>
    );
  }

  if (phase === "pendingSync") {
    return (
      <Shell>
        <Text style={styles.title}>Still saving your answers</Text>
        <Text style={styles.subtitle}>
          Your answers are safe on this device. They'll be submitted automatically the
          next time you open the app with a connection, or you can try again now.
        </Text>
        <Button label="Try now" onPress={retrySubmit} />
        <Button label="Profile" variant="secondary" onPress={() => router.push("/profile")} />
      </Shell>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
      <ProgressBar total={questionCount} index={deck.index} />

      <View style={styles.header}>
        <Text style={styles.testTitle} numberOfLines={1}>
          {test.title}
        </Text>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to the previous question"
            accessibilityState={{ disabled: !deck.canGoBack }}
            disabled={!deck.canGoBack}
            onPress={deck.back}
            style={({ pressed }) => [
              styles.backButton,
              !deck.canGoBack && styles.backDisabled,
              pressed && deck.canGoBack && styles.backPressed,
            ]}
          >
            <Text style={styles.backLabel}>{"← Back"}</Text>
          </Pressable>
          <Text style={styles.counter}>{Math.max(remaining, 0)} left</Text>
        </View>
      </View>

      <CardStack
        items={test.questions}
        activeIndex={deck.index}
        keyExtractor={(question) => question.id}
        renderCard={(question, isActive) => (
          <QuestionCard question={question} isActive={isActive} onAnswer={deck.answer} />
        )}
      />

      {(phase === "submitting" || phase === "checkingNext") && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={theme.colors.textSecondary} />
        </View>
      )}

      {phase === "popup" && result && (
        <CompletionPopup result={result} onDismiss={() => void advance()} />
      )}
    </SafeAreaView>
  );
}

function CompletionPopup({
  result,
  onDismiss,
}: {
  result: SubmitResult;
  onDismiss: () => void;
}) {
  // Auto-continues the feed shortly after showing the reward, matching the
  // continuous, TikTok-style feel (prd.md 15.4) - a tap just gets there sooner.
  useEffect(() => {
    const timer = setTimeout(onDismiss, 1800);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <Pressable style={styles.popupBackdrop} onPress={onDismiss}>
      <View style={styles.popupCard}>
        {result.isFlagged ? (
          <>
            <Text style={styles.popupTitle}>Test complete</Text>
            <Text style={styles.popupSubtitle}>
              This test needs a closer look before its reward is credited.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.popupTitle}>Test complete</Text>
            <Text style={styles.popupPoints}>+{result.pointsEarned} pts</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.centered}>{children}</View>
    </SafeAreaView>
  );
}

/**
 * Best-effort warm of the next test's opening card, so the feed has no visible loading
 * gap the moment it continues into it (plan.md 11.1).
 *
 * Only image media has a prefetch primitive available here (`Image.prefetch`) - video
 * and audio play by streaming rather than by a fetch-then-show step, so there is nothing
 * equivalent to warm for them.
 */
function prefetchFirstCardMedia(test: EvaluatorTest): void {
  const firstQuestion = test.questions[0];
  if (!firstQuestion || firstQuestion.mediaType !== "IMAGE") return;

  for (const option of firstQuestion.options) {
    const url = resolveMediaUrl(option.mediaUrl);
    if (url) Image.prefetch(url).catch(() => undefined);
  }
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(3),
    paddingTop: theme.spacing(1.5),
    paddingBottom: theme.spacing(1.5),
  },
  testTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "600", flexShrink: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: theme.spacing(1.5) },
  backButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: theme.spacing(1.5),
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceRaised,
  },
  backDisabled: { opacity: 0.35 },
  backPressed: { opacity: 0.7 },
  backLabel: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600" },
  counter: { color: theme.colors.textSecondary, fontSize: 14, fontVariant: ["tabular-nums"] },
  title: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700", textAlign: "center" },
  subtitle: { color: theme.colors.textSecondary, fontSize: 15, textAlign: "center" },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  popupBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 11, 15, 0.72)",
    padding: theme.spacing(3),
  },
  popupCard: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(3.5),
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
  },
  popupTitle: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: "700" },
  popupSubtitle: { color: theme.colors.textSecondary, fontSize: 14, textAlign: "center" },
  popupPoints: { color: theme.colors.accent, fontSize: 32, fontWeight: "800" },
});
