"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { AnswerData, TestDetail } from "@/lib/test-types";

type TestSessionState = {
  test: TestDetail | null;
  answers: Map<string, AnswerData>;
  /** Server-signed token holding the authoritative session start time. */
  sessionToken: string | null;
  questionTimers: Map<string, number>; // accumulated seconds per question
};

type TestSessionContextValue = {
  state: TestSessionState;
  startSession: (test: TestDetail) => void;
  setAnswer: (questionId: string, data: Partial<AnswerData>) => void;
  recordTime: (questionId: string, seconds: number) => void;
  getAnswer: (questionId: string) => AnswerData | undefined;
  resetSession: () => void;
};

const initialAnswer: AnswerData = {
  selectedOptionIds: [],
  ratingValue: null,
  textValue: "",
  timeSpentSeconds: 0,
};

const TestSessionContext = createContext<TestSessionContextValue | null>(null);

export function TestSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TestSessionState>({
    test: null,
    answers: new Map(),
    sessionToken: null,
    questionTimers: new Map(),
  });

  const startSession = useCallback((test: TestDetail) => {
    setState({
      test,
      answers: new Map(),
      sessionToken: test.sessionToken,
      questionTimers: new Map(),
    });
  }, []);

  const setAnswer = useCallback((questionId: string, data: Partial<AnswerData>) => {
    setState((prev) => {
      const existing = prev.answers.get(questionId) ?? { ...initialAnswer };
      const updated = new Map(prev.answers);
      updated.set(questionId, { ...existing, ...data });
      return { ...prev, answers: updated };
    });
  }, []);

  const recordTime = useCallback((questionId: string, seconds: number) => {
    setState((prev) => {
      const timers = new Map(prev.questionTimers);
      timers.set(questionId, (timers.get(questionId) ?? 0) + seconds);
      // Also update the answer's timeSpentSeconds
      const answers = new Map(prev.answers);
      const existing = answers.get(questionId) ?? { ...initialAnswer };
      answers.set(questionId, { ...existing, timeSpentSeconds: timers.get(questionId)! });
      return { ...prev, questionTimers: timers, answers };
    });
  }, []);

  const getAnswer = useCallback(
    (questionId: string) => state.answers.get(questionId),
    [state.answers]
  );

  const resetSession = useCallback(() => {
    setState({ test: null, answers: new Map(), sessionToken: null, questionTimers: new Map() });
  }, []);

  return (
    <TestSessionContext.Provider
      value={{ state, startSession, setAnswer, recordTime, getAnswer, resetSession }}
    >
      {children}
    </TestSessionContext.Provider>
  );
}

export function useTestSession() {
  const ctx = useContext(TestSessionContext);
  if (!ctx) throw new Error("useTestSession must be used inside TestSessionProvider");
  return ctx;
}
