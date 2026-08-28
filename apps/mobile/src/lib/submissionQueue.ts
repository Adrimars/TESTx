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

/**
 * Scoped by the signed-in user's id (16.10) - a fixed, unscoped key let evaluator A's
 * leftover pending submission get read back and resubmitted under evaluator B's bearer
 * token the moment B signed in on the same device, since both `retryPendingSubmissionOnce`
 * (fired at launch) and every read/write here had no way to tell whose record it was
 * looking at. `session.tsx`'s `signOut()` also clears the outgoing user's own keys as
 * belt-and-suspenders hygiene, but the scoping here is what actually closes the gap: a
 * different user's id is simply a different key, never the same storage slot.
 */
const IN_PROGRESS_KEY_PREFIX = "testx.inProgressTest";
const PENDING_SUBMISSION_KEY_PREFIX = "testx.pendingSubmission";

function inProgressKey(userId: string): string {
  return `${IN_PROGRESS_KEY_PREFIX}.${userId}`;
}

function pendingSubmissionKey(userId: string): string {
  return `${PENDING_SUBMISSION_KEY_PREFIX}.${userId}`;
}

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

export const readInProgressTest = (userId: string): Promise<InProgressTest | null> =>
  readJson<InProgressTest>(inProgressKey(userId));
export const writeInProgressTest = (userId: string, value: InProgressTest): Promise<void> =>
  writeJson(inProgressKey(userId), value);
export const clearInProgressTest = (userId: string): Promise<void> =>
  removeJson(inProgressKey(userId));

export const readPendingSubmission = (userId: string): Promise<PendingSubmission | null> =>
  readJson<PendingSubmission>(pendingSubmissionKey(userId));
export const writePendingSubmission = (userId: string, value: PendingSubmission): Promise<void> =>
  writeJson(pendingSubmissionKey(userId), value);
export const clearPendingSubmission = (userId: string): Promise<void> =>
  removeJson(pendingSubmissionKey(userId));

/**
 * Only ever resumes a record for the exact test being asked about - a different test id
 * means this is a leftover from an abandoned session, not a match.
 */
async function fetchInProgressForTest(userId: string, testId: string): Promise<InProgressTest | null> {
  const stored = await readInProgressTest(userId);
  return stored && stored.testId === testId ? stored : null;
}

/**
 * Composed the same way `useEvaluatorTest` gates on `testId`, so it slots into
 * `feed.tsx`'s existing pending/error/empty gate.
 */
export function useInProgressTest(userId: string | undefined, testId: string | undefined) {
  return useQuery({
    queryKey: ["in-progress-test", userId, testId],
    enabled: Boolean(userId) && Boolean(testId),
    queryFn: () => fetchInProgressForTest(userId!, testId!),
    // `writeInProgressTest` mutates AsyncStorage directly on every answer, entirely outside
    // React Query's cache. `staleTime: 0` alone isn't enough: a cache hit still reports
    // `isPending: false` synchronously on mount regardless of staleness, so `feed.tsx`'s
    // loading gate would wave TestDeck through onto a leftover value from an earlier visit
    // to this same test before the background revalidation lands - locking in the wrong
    // starting index for `useDeck`'s lazy initializer, which only ever reads it once, at
    // mount. `gcTime: 0` drops the cached entry the instant this hook's one observer
    // unmounts (leaving the feed screen, via the 16.5 close button or otherwise), so the
    // next mount - the exit-and-immediately-resume case 16.5 introduced - starts genuinely
    // cold and actually waits on a fresh read instead of trusting a stale one.
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * Primes the same query cache entry for a test that's only been prefetched, not opened
 * yet (11.1's continuous-feed prefetch). Without this, `useInProgressTest` mounts with a
 * cold cache the instant the feed continues into that test, and `feed.tsx`'s loading gate
 * shows a second, whole-screen spinner right after the completion popup - the exact
 * loading gap 11.1's prefetch exists to avoid. A prefetched test has never been opened,
 * so this always resolves to `null`, but the gate has no way to know that without asking.
 */
export function prefetchInProgressTest(queryClient: QueryClient, userId: string, testId: string) {
  return queryClient.fetchQuery({
    queryKey: ["in-progress-test", userId, testId],
    queryFn: () => fetchInProgressForTest(userId, testId),
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
  userId: string,
  payload: PendingSubmission
): Promise<{ status: "success"; result: SubmitResult } | PendingResult | { status: "pending" }> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
    const outcome = await attemptSubmitOnce(payload);
    if (outcome.status === "network") continue;

    await clearPendingSubmission(userId);
    if (outcome.status === "success") invalidateAfterSubmit(queryClient);
    return outcome;
  }
  // Exhausted the window on network failures alone - stays queued for the next launch's
  // single attempt (see `retryPendingSubmissionOnce`) rather than being given up on.
  return { status: "pending" };
}

/**
 * Fired once at app launch, once the signed-in user is known (see `_layout.tsx`'s
 * `PendingSubmissionRetry`, mounted inside `SessionProvider` and gated on
 * `!initializing`). A test finished last session and killed or backgrounded before its
 * submission confirmed still has its payload queued; this is the "retry once
 * automatically on next app launch" half of 11.4. Deliberately a single attempt with no
 * backoff loop and no UI - the evaluator isn't watching a "syncing" screen for a test
 * they may have finished hours ago, so this reconciles quietly and leaves the payload
 * queued again on a further network failure.
 *
 * `userId` scopes which record this reads (16.10): waiting for the real signed-in user,
 * rather than firing blind at launch the way this used to, is what stops evaluator B's
 * bearer token ever being used to resubmit a payload evaluator A queued and never signed
 * out cleanly from - a different user id is simply a different storage key.
 */
export async function retryPendingSubmissionOnce(
  queryClient: QueryClient,
  userId: string
): Promise<void> {
  const pending = await readPendingSubmission(userId);
  if (!pending) return;

  const outcome = await attemptSubmitOnce(pending);
  if (outcome.status === "network") return;

  await clearPendingSubmission(userId);
  if (outcome.status === "success") invalidateAfterSubmit(queryClient);
}
