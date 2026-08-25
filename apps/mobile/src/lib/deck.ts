import { useCallback, useMemo, useRef, useState } from "react";
import type { EvaluatorQuestion } from "./test";

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

export type Deck = {
  questions: EvaluatorQuestion[];
  index: number;
  current: EvaluatorQuestion | undefined;
  answers: Record<string, DeckAnswer>;
  isComplete: boolean;
  answer: (answer: Omit<DeckAnswer, "timeSpentSeconds">) => void;
};

/**
 * Owns the deck cursor and the in-memory answers map for one test.
 *
 * Phase 11 layers submission, progress and rewards on top; this deliberately knows
 * nothing about either, so the card components can be exercised on their own.
 */
export function useDeck(questions: EvaluatorQuestion[]): Deck {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, DeckAnswer>>({});
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
    setAnswers((current) => ({
      ...current,
      [next.questionId]: { ...next, timeSpentSeconds },
    }));
    shownAt.current = now;
    setIndex((current) => current + 1);
  }, []);

  const current = questions[index];

  return useMemo(
    () => ({
      questions,
      index,
      current,
      answers,
      isComplete: index >= questions.length,
      answer,
    }),
    [questions, index, current, answers, answer]
  );
}
