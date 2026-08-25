import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./api";

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
    queryFn: () => apiFetch<EvaluatorTest>(`/evaluator/tests/${testId}`),
  });
}
