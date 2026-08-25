import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "./api";
import type { DeckAnswer, DeckState } from "./deckState";
import type { SubmitResult } from "./test";

/**
 * Offline-safe handling of the one background `submit` call a completed test's reward
 * hinges on (plan.md 11.4). Everything here is deliberately framework-free and callable
 * from outside a mounted screen, because the two places it has to run are a live
 * `TestDeck` *and* a top-level effect at app launch, before any test screen exists.
 *
 * Unlike `expo-secure-store` (tokens.ts, tutorial.ts) - whose web module is a stub, hence
 * those files' own `localStorage` fallback - AsyncStorage already ships a `window
 * .localStorage`-backed implementation for the web platform, so no separate shim is
 * needed to keep this working on the Expo web dev target.
 */

const IN_PROGRESS_KEY = "testx.inProgressTest";
const PENDING_SUBMISSION_KEY = "testx.pendingSubmission";

export type InProgressTest = {
  testId: string;
  sessionToken: string;
} & DeckState;

export type PendingSubmission = {
  testId: string;
  sessionToken: string;
  answers: DeckAnswer[];
};

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort: a write failure costs resume/retry safety on this one card, not the
    // in-progress test itself, which is still live in memory.
  }
}

async function removeJson(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Nothing to recover into - worst case a stale record gets overwritten next write.
  }
}

export const readInProgressTest = (): Promise<InProgressTest | null> =>
  readJson<InProgressTest>(IN_PROGRESS_KEY);
export const writeInProgressTest = (value: InProgressTest): Promise<void> =>
  writeJson(IN_PROGRESS_KEY, value);
export const clearInProgressTest = (): Promise<void> => removeJson(IN_PROGRESS_KEY);

export const readPendingSubmission = (): Promise<PendingSubmission | null> =>
  readJson<PendingSubmission>(PENDING_SUBMISSION_KEY);
export const writePendingSubmission = (value: PendingSubmission): Promise<void> =>
  writeJson(PENDING_SUBMISSION_KEY, value);
export const clearPendingSubmission = (): Promise<void> => removeJson(PENDING_SUBMISSION_KEY);

/**
 * Only ever resumes a record for the exact test currently being opened - a different
 * test id means this is a leftover from an abandoned session, not a match, so it isn't
 * offered back to `useDeck`. Composed the same way `useEvaluatorTest` gates on `testId`,
 * so it slots into `feed.tsx`'s existing pending/error/empty gate.
 */
export function useInProgressTest(testId: string | undefined) {
  return useQuery({
    queryKey: ["in-progress-test", testId],
    enabled: Boolean(testId),
    queryFn: async () => {
      const stored = await readInProgressTest();
      return stored && stored.testId === testId ? stored : null;
    },
  });
}

function invalidateAfterSubmit(queryClient: QueryClient): void {
  // The reward, the home screen's list, and what "next" means have all just changed.
  void queryClient.invalidateQueries({ queryKey: ["balance"] });
  void queryClient.invalidateQueries({ queryKey: ["available-tests"] });
  void queryClient.invalidateQueries({ queryKey: ["next-test"] });
}

function submitTest(payload: PendingSubmission): Promise<SubmitResult> {
  return apiFetch<SubmitResult>(`/evaluator/tests/${payload.testId}/submit`, {
    method: "POST",
    body: JSON.stringify({ sessionToken: payload.sessionToken, answers: payload.answers }),
  });
}

/** Submit errors that mean this test is already settled - never worth retrying. */
const SETTLED_CODES = new Set([
  "ALREADY_SUBMITTED",
  "TEST_PAUSED",
  "TEST_CLOSED",
  "NOT_AVAILABLE",
  "CAPACITY_REACHED",
]);

/**
 * Submit errors that mean this exact payload can never succeed (bad/expired session,
 * an answer the server won't accept, a question missing) - retrying it again would just
 * fail the same way, so these are terminal too, but distinct from "settled": nothing
 * good happened for the evaluator here.
 */
const TERMINAL_REJECT_CODES = new Set(["INVALID_SESSION", "INVALID_ANSWER", "INCOMPLETE"]);

export type SubmitOutcome =
  | { status: "success"; result: SubmitResult }
  | { status: "settled" }
  | { status: "rejected"; message: string }
  | { status: "network" };

async function attemptSubmitOnce(payload: PendingSubmission): Promise<SubmitOutcome> {
  try {
    const result = await submitTest(payload);
    return { status: "success", result };
  } catch (error) {
    if (error instanceof ApiError) {
      if (SETTLED_CODES.has(error.code ?? "")) return { status: "settled" };
      if (TERMINAL_REJECT_CODES.has(error.code ?? "")) {
        return { status: "rejected", message: error.message };
      }
      // An ApiError this queue doesn't recognise (e.g. a 5xx) behaves like a network
      // failure: transient, worth retrying, not a verdict on the answers themselves.
    }
    return { status: "network" };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ~8 minutes of backoff across 6 attempts after the first immediate one. Bounded rather
 * than unbounded: the quality service's own idle-time check (`quality.service.ts`,
 * `IDLE_GRACE_SECONDS`) flags a submission that lands long after the test was actually
 * finished, crediting zero points even though the answers are fine - retrying forever
 * would just replace a lost connection with a silent zero-point "success". Past this
 * window the honest answer is "still trying", not a fabricated result either way.
 */
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 240_000];

export type PendingResult = { status: "settled" } | { status: "rejected"; message: string };

/**
 * Retries a just-finished test's submission for a bounded window, for the live feed:
 * the evaluator is still on screen, so it's worth holding a "syncing" state open rather
 * than declaring success or failure prematurely.
 */
export async function submitWithBackoff(
  queryClient: QueryClient,
  payload: PendingSubmission
): Promise<{ status: "success"; result: SubmitResult } | PendingResult | { status: "pending" }> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
    const outcome = await attemptSubmitOnce(payload);
    if (outcome.status === "network") continue;

    await clearPendingSubmission();
    if (outcome.status === "success") invalidateAfterSubmit(queryClient);
    return outcome;
  }
  // Exhausted the window on network failures alone - stays queued for the next launch's
  // single attempt (see `retryPendingSubmissionOnce`) rather than being given up on.
  return { status: "pending" };
}

/**
 * Fired once at app launch (see `_layout.tsx`). A test finished last session and killed
 * or backgrounded before its submission confirmed still has its payload queued; this is
 * the "retry once automatically on next app launch" half of 11.4. Deliberately a single
 * attempt with no backoff loop and no UI - the evaluator isn't watching a "syncing"
 * screen for a test they may have finished hours ago, so this reconciles quietly and
 * leaves the payload queued again on a further network failure.
 */
export async function retryPendingSubmissionOnce(queryClient: QueryClient): Promise<void> {
  const pending = await readPendingSubmission();
  if (!pending) return;

  const outcome = await attemptSubmitOnce(pending);
  if (outcome.status === "network") return;

  await clearPendingSubmission();
  if (outcome.status === "success") invalidateAfterSubmit(queryClient);
}
