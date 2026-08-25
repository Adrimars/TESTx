import { useCallback, useMemo, useState } from "react";
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
  const [shownAt, setShownAt] = useState(() => Date.now());

  const answer = useCallback(
    (next: Omit<DeckAnswer, "timeSpentSeconds">) => {
      const now = Date.now();
      const timeSpentSeconds = Math.max(0, Math.round((now - shownAt) / 1000));
      setAnswers((current) => ({
        ...current,
        [next.questionId]: { ...next, timeSpentSeconds },
      }));
      setShownAt(now);
      setIndex((current) => current + 1);
    },
    [shownAt]
  );

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
