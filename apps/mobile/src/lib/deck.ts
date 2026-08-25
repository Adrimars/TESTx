import { useCallback, useMemo, useRef, useState } from "react";
import {
  initialDeckState,
  isDeckComplete,
  recordAnswer,
  stepBack,
  type DeckAnswer,
  type DeckState,
} from "./deckState";
import type { EvaluatorQuestion } from "./test";

export type { DeckAnswer } from "./deckState";

export type Deck = {
  questions: EvaluatorQuestion[];
  index: number;
  current: EvaluatorQuestion | undefined;
  answers: Record<string, DeckAnswer>;
  isComplete: boolean;
  canGoBack: boolean;
  answer: (answer: Omit<DeckAnswer, "timeSpentSeconds">) => void;
  back: () => void;
};

/**
 * Owns the deck cursor and the in-memory answers map for one test.
 *
 * Phase 11 layers submission, progress and rewards on top; this deliberately knows
 * nothing about either, so the card components can be exercised on their own.
 */
export function useDeck(questions: EvaluatorQuestion[]): Deck {
  const [state, setState] = useState<DeckState>(initialDeckState);

  // Per-question timing is measured from when the card became active, not from when the
  // test was opened, so a pause on one question does not inflate the next one.
  //
  // A ref rather than state: two cards can commit within one render pass - the multi
  // select sub-deck resolves several option cards in quick succession - and state read
  // through a closure would still hold the previous card's timestamp, charging this
  // question for time the last one took. That feeds straight into the speed check that
  // withholds rewards, so it has to be read at call time.
  const shownAt = useRef(Date.now());

  const answer = useCallback((next: Omit<DeckAnswer, "timeSpentSeconds">) => {
    const now = Date.now();
    const timeSpentSeconds = Math.max(0, Math.round((now - shownAt.current) / 1000));
    shownAt.current = now;
    setState((current) => recordAnswer(current, { ...next, timeSpentSeconds }));
  }, []);

  const back = useCallback(() => {
    setState((current) => {
      const previous = questions[current.index - 1];
      if (!previous) return current;
      return stepBack(current, previous.id);
    });
    // The re-surfaced card is being answered afresh, so its clock starts again here
    // rather than counting the time already spent on the card being left.
    shownAt.current = Date.now();
  }, [questions]);

  const current = questions[state.index];

  return useMemo(
    () => ({
      questions,
      index: state.index,
      current,
      answers: state.answers,
      isComplete: isDeckComplete(state, questions.length),
      canGoBack: state.canGoBack && state.index > 0,
      answer,
      back,
    }),
    [questions, state, current, answer, back]
  );
}
