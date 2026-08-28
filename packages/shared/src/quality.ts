/**
 * How many attention checks a test gets automatically when it is activated.
 *
 * One check per test regardless of length made short tests mostly quality control, so the
 * quota now scales with the test: nothing at all below the floor, then roughly one per
 * bucket of questions, capped so long tests do not turn into a gauntlet.
 */
export const ATTENTION_CHECK_MIN_QUESTIONS = 8;
export const ATTENTION_CHECK_PER_QUESTIONS = 10;
export const ATTENTION_CHECK_MAX = 2;

/**
 * Target number of attention checks for a test, counted over its *scored* questions —
 * attention checks and trap duplicates do not count towards the length that justifies them.
 *
 * 0–7 questions → 0, 8–19 → 1, 20+ → 2.
 */
export function autoAttentionCheckCount(scoredQuestionCount: number): number {
  if (scoredQuestionCount < ATTENTION_CHECK_MIN_QUESTIONS) return 0;
  const byRatio = Math.floor(scoredQuestionCount / ATTENTION_CHECK_PER_QUESTIONS);
  return Math.min(ATTENTION_CHECK_MAX, Math.max(1, byRatio));
}
