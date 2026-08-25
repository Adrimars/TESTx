import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";
import type { DeckAnswer } from "./deckState";

/** Mirrors `serializeQuestion` in apps/api/src/routes/evaluator.ts. */
export type EvaluatorOption = {
  id: string;
  questionId: string;
  label: string | null;
  mediaId: string | null;
  order: number;
  mediaUrl: string | null;
  media: {
    id: string;
    fileName: string;
    fileType: string;
    mimeType: string;
    thumbnailUrl: string | null;
    url: string;
  } | null;
};

export type QuestionType = "SINGLE_SELECT" | "MULTI_SELECT" | "RATING" | "RANKING";

export type EvaluatorQuestion = {
  id: string;
  testId: string;
  type: QuestionType;
  prompt: string;
  mediaType: string | null;
  order: number;
  /** Only the keys PUBLIC_CONFIG_KEYS forwards for this type; everything else stays server-side. */
  config: {
    minSelections?: number;
    maxSelections?: number;
    min?: number;
    max?: number;
    minLabel?: string;
    maxLabel?: string;
    bestLabel?: string;
    worstLabel?: string;
  };
  isReviewHidden: boolean;
  options: EvaluatorOption[];
};

export type EvaluatorTest = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  advisoryTimeMin: number | null;
  minTimePerQuestion: number | null;
  rewardPoints: number;
  questionCount: number;
  questions: EvaluatorQuestion[];
  sessionToken: string;
};

export type NextTestSummary = {
  id: string;
  title: string;
  description: string | null;
  rewardPoints: number;
  questionCount: number;
} | null;

export type AvailableTest = {
  id: string;
  title: string;
  description: string | null;
  rewardPoints: number;
  questionCount: number;
  advisoryTimeMin: number | null;
};

/** Everything on offer, for the home screen. */
export function useAvailableTests() {
  return useQuery({
    queryKey: ["available-tests"],
    queryFn: () => apiFetch<AvailableTest[]>("/evaluator/available-tests"),
  });
}

export function useNextTest() {
  return useQuery({
    queryKey: ["next-test"],
    queryFn: () => apiFetch<NextTestSummary>("/evaluator/next-test"),
  });
}

function fetchTest(testId: string) {
  return apiFetch<EvaluatorTest>(`/evaluator/tests/${testId}`);
}

export function useEvaluatorTest(testId: string | undefined) {
  return useQuery({
    queryKey: ["test", testId],
    // The response carries a sessionToken minted at fetch time, which the submit call has
    // to echo back. Refetching mints a new one and restarts the clock the quality service
    // measures against, so this stays put for as long as the deck is open.
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled: Boolean(testId),
    queryFn: () => fetchTest(testId!),
  });
}

/**
 * Primes the query cache for a test the feed hasn't opened yet.
 *
 * Used by the continuous-feed prefetch (11.1): fetched under the same query key
 * `useEvaluatorTest` reads, so opening the prefetched test is a cache hit, not a fetch -
 * that's what makes the test-to-test transition gapless.
 */
export function prefetchTest(queryClient: QueryClient, testId: string) {
  return queryClient.fetchQuery({
    queryKey: ["test", testId],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => fetchTest(testId),
  });
}

export function prefetchNextTest(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: ["next-test"],
    queryFn: () => apiFetch<NextTestSummary>("/evaluator/next-test"),
  });
}

export type SubmitResult = {
  pointsEarned: number;
  isFlagged: boolean;
  flagReasons: string[];
};

/** Fires the one-shot, per-test reward submission. */
export function useSubmitTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      testId,
      sessionToken,
      answers,
    }: {
      testId: string;
      sessionToken: string;
      answers: DeckAnswer[];
    }) =>
      apiFetch<SubmitResult>(`/evaluator/tests/${testId}/submit`, {
        method: "POST",
        body: JSON.stringify({ sessionToken, answers }),
      }),
    onSuccess: () => {
      // The reward, the home screen's list, and what "next" means have all just changed.
      void queryClient.invalidateQueries({ queryKey: ["balance"] });
      void queryClient.invalidateQueries({ queryKey: ["available-tests"] });
      void queryClient.invalidateQueries({ queryKey: ["next-test"] });
    },
  });
}

export function useBalance() {
  return useQuery({
    queryKey: ["balance"],
    queryFn: () => apiFetch<{ balance: number }>("/evaluator/balance"),
  });
}
