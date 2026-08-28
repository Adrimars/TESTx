/**
 * Pure deck-cursor transitions, kept free of react so they can be exercised without a
 * renderer - same reasoning as swipe.ts and version.ts.
 */

/**
 * One answer in the shape `POST /evaluator/tests/:id/submit` expects. Kept identical to
 * the web evaluator's session state so both clients submit the same payload.
 */
export type DeckAnswer = {
  questionId: string;
  selectedOptionIds: string[];
  ratingValue?: number;
  timeSpentSeconds: number;
};

export type DeckState = {
  index: number;
  answers: Record<string, DeckAnswer>;
  /**
   * False right after stepping back. Back is one level of recall, not an undo stack: the
   * deck only remembers the card the evaluator just left, and stepping back again would
   * be walking a history it never kept.
   */
  canGoBack: boolean;
};

export const initialDeckState: DeckState = { index: 0, answers: {}, canGoBack: false };

/** Records an answer for the current card and advances. */
export function recordAnswer(state: DeckState, answer: DeckAnswer): DeckState {
  return {
    index: state.index + 1,
    answers: { ...state.answers, [answer.questionId]: answer },
    canGoBack: true,
  };
}

/**
 * Re-surfaces the previous card with its answer discarded, so it comes back genuinely
 * unanswered rather than pre-filled with a choice the evaluator is trying to change.
 *
 * Only that one answer is dropped. Everything decided before it is untouched, which is
 * the whole point: going back to fix one card must not cost the evaluator the rest of
 * the work they have already done.
 */
export function stepBack(state: DeckState, previousQuestionId: string): DeckState {
  if (!state.canGoBack || state.index === 0) return state;

  const answers = { ...state.answers };
  delete answers[previousQuestionId];

  return { index: state.index - 1, answers, canGoBack: false };
}

/** True once every question has been decided. */
export function isDeckComplete(state: DeckState, questionCount: number): boolean {
  return state.index >= questionCount;
}
