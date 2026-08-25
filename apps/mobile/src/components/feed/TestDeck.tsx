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
  prefetchNextTest,
  prefetchTest,
  useSubmitTest,
  type EvaluatorTest,
  type SubmitResult,
} from "@/lib/test";
import { theme } from "@/lib/theme";
import { ProgressBar } from "./ProgressBar";

/** Fire the background next-test lookup with this many questions left to answer. */
const PREFETCH_WINDOW = 2;

/** Submit errors that mean this test is already settled - never worth retrying. */
const SETTLED_SUBMIT_CODES = new Set([
  "ALREADY_SUBMITTED",
  "TEST_PAUSED",
  "TEST_CLOSED",
  "NOT_AVAILABLE",
  "CAPACITY_REACHED",
]);

/**
 * A test `/next-test` just offered can still turn out unopenable by the time the full
 * fetch runs (capacity filled, eligibility changed) - these are the codes that mean "not
 * this one", not "something is broken". `/next-test` re-evaluates every candidate fresh
 * from the database, so asking it again is a real retry, not a repeat of the same answer.
 */
const UNAVAILABLE_NEXT_CODES = new Set(["NOT_AVAILABLE", "CAPACITY_REACHED", "NOT_ELIGIBLE", "NOT_FOUND"]);
const MAX_NEXT_TEST_ATTEMPTS = 3;

/** Finds a test the feed can actually open next, skipping past ones that just fell through. */
async function findNextTest(queryClient: QueryClient): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_NEXT_TEST_ATTEMPTS; attempt += 1) {
    const next = await prefetchNextTest(queryClient);
    if (!next) return null;
    try {
      const full = await prefetchTest(queryClient, next.id);
      prefetchFirstCardMedia(full);
      return next.id;
    } catch (error) {
      if (error instanceof ApiError && UNAVAILABLE_NEXT_CODES.has(error.code ?? "")) continue;
      return null;
    }
  }
  return null;
}

type Phase = "answering" | "submitting" | "popup" | "checkingNext" | "empty" | "error";

type TestDeckProps = {
  test: EvaluatorTest;
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
export function TestDeck({ test, onContinue }: TestDeckProps) {
  const router = useRouter();
  const { signOut } = useSession();
  const queryClient = useQueryClient();
  const deck = useDeck(test.questions);
  const submit = useSubmitTest();

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
    prefetchRef.current = findNextTest(queryClient);
  }, [remaining, queryClient]);

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

    submit.mutate(
      { testId: test.id, sessionToken: test.sessionToken, answers },
      {
        onSuccess: (data) => {
          setResult(data);
          setPhase("popup");
        },
        onError: (error) => {
          if (error instanceof ApiError && SETTLED_SUBMIT_CODES.has(error.code ?? "")) {
            // The test is decided one way or another already (submitted, paused, closed,
            // full) - nothing here is fixed by showing an error, so just move on.
            setResult(null);
            void advance();
            return;
          }
          setErrorMessage(error instanceof Error ? error.message : "Could not submit your answers.");
          setPhase("error");
        },
      }
    );
  }, [deck.isComplete, phase]);

  /** Moves the feed into whatever test comes next, or ends it. */
  async function advance() {
    setPhase("checkingNext");
    const nextId = await (prefetchRef.current ?? findNextTest(queryClient));

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
    return (
      <Shell>
        <Text style={styles.title}>Could not submit your answers</Text>
        <Text style={styles.subtitle}>{errorMessage ?? "Something went wrong."}</Text>
        <Button label="Try again" onPress={retrySubmit} />
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
