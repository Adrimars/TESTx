"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type QuestionType = "SINGLE_SELECT" | "MULTI_SELECT" | "RATING" | "FREE_TEXT";
export type MediaType = "IMAGE" | "VIDEO" | "AUDIO" | "TEXT";

export type TestQuestionOption = {
  id: string;
  label: string | null;
  mediaId: string | null;
  order: number;
  mediaUrl: string | null;
  media: {
    id: string;
    fileName: string;
    fileType: "IMAGE" | "VIDEO" | "AUDIO";
    mimeType: string;
    thumbnailUrl: string | null;
    url: string;
  } | null;
};

export type TestQuestion = {
  id: string;
  testId: string;
  type: QuestionType;
  prompt: string;
  mediaType: MediaType | null;
  order: number;
  config: Record<string, unknown>;
  options: TestQuestionOption[];
};

export type TestSessionData = {
  id: string;
  title: string;
  description: string | null;
  advisoryTimeMin: number | null;
  minTimePerQuestion: number;
  rewardPoints: number;
  questionCount: number;
  questions: TestQuestion[];
};

export type AnswerState = {
  questionId: string;
  selectedOptionIds: string[];
  ratingValue: number | null;
  textValue: string;
};

type TestSessionContextValue = {
  session: TestSessionData | null;
  answers: Map<string, AnswerState>;
  startedAt: Date | null;
  startSession: (data: TestSessionData) => void;
  endSession: () => void;
  setAnswer: (questionId: string, patch: Partial<AnswerState>) => void;
  getAnswer: (questionId: string) => AnswerState | undefined;
  markQuestionVisited: (questionId: string) => void;
  consumeTime: (questionId: string) => number;
  getTotalTimeFor: (questionId: string) => number;
};

const TestSessionContext = createContext<TestSessionContextValue | null>(null);

function defaultAnswer(question: TestQuestion): AnswerState {
  return {
    questionId: question.id,
    selectedOptionIds: [],
    ratingValue: null,
    textValue: "",
  };
}

export function TestSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<TestSessionData | null>(null);
  const [answers, setAnswers] = useState<Map<string, AnswerState>>(new Map());
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const totalTimeRef = useRef<Map<string, number>>(new Map());
  const activeTimerRef = useRef<{ questionId: string; startedAt: number } | null>(null);

  const startSession = useCallback((data: TestSessionData) => {
    setSession(data);
    const initial = new Map<string, AnswerState>();
    for (const question of data.questions) {
      initial.set(question.id, defaultAnswer(question));
    }
    setAnswers(initial);
    setStartedAt(new Date());
    totalTimeRef.current = new Map();
    activeTimerRef.current = null;
  }, []);

  const endSession = useCallback(() => {
    setSession(null);
    setAnswers(new Map());
    setStartedAt(null);
    totalTimeRef.current = new Map();
    activeTimerRef.current = null;
  }, []);

  const setAnswer = useCallback((questionId: string, patch: Partial<AnswerState>) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      const existing = next.get(questionId);
      if (!existing) return prev;
      next.set(questionId, { ...existing, ...patch });
      return next;
    });
  }, []);

  const getAnswer = useCallback(
    (questionId: string) => answers.get(questionId),
    [answers]
  );

  const consumeTime = useCallback((questionId: string) => {
    const totals = totalTimeRef.current;
    const active = activeTimerRef.current;
    if (active && active.questionId === questionId) {
      const elapsed = Math.floor((Date.now() - active.startedAt) / 1000);
      totals.set(questionId, (totals.get(questionId) ?? 0) + elapsed);
      activeTimerRef.current = null;
    }
    return totals.get(questionId) ?? 0;
  }, []);

  const markQuestionVisited = useCallback(
    (questionId: string) => {
      const active = activeTimerRef.current;
      if (active && active.questionId === questionId) return;
      if (active) {
        const elapsed = Math.floor((Date.now() - active.startedAt) / 1000);
        totalTimeRef.current.set(
          active.questionId,
          (totalTimeRef.current.get(active.questionId) ?? 0) + elapsed
        );
      }
      activeTimerRef.current = { questionId, startedAt: Date.now() };
    },
    []
  );

  const getTotalTimeFor = useCallback((questionId: string) => {
    const active = activeTimerRef.current;
    const recorded = totalTimeRef.current.get(questionId) ?? 0;
    if (active && active.questionId === questionId) {
      return recorded + Math.floor((Date.now() - active.startedAt) / 1000);
    }
    return recorded;
  }, []);

  useEffect(() => {
    if (!session) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [session]);

  const value = useMemo<TestSessionContextValue>(
    () => ({
      session,
      answers,
      startedAt,
      startSession,
      endSession,
      setAnswer,
      getAnswer,
      markQuestionVisited,
      consumeTime,
      getTotalTimeFor,
    }),
    [
      session,
      answers,
      startedAt,
      startSession,
      endSession,
      setAnswer,
      getAnswer,
      markQuestionVisited,
      consumeTime,
      getTotalTimeFor,
    ]
  );

  return <TestSessionContext.Provider value={value}>{children}</TestSessionContext.Provider>;
}

export function useTestSession() {
  const context = useContext(TestSessionContext);
  if (!context) throw new Error("useTestSession must be used within TestSessionProvider");
  return context;
}

export function isAnswered(question: TestQuestion, answer: AnswerState | undefined): boolean {
  if (!answer) return false;
  if (question.type === "FREE_TEXT") {
    const minChars = typeof question.config.minChars === "number" ? question.config.minChars : 0;
    return answer.textValue.trim().length >= minChars;
  }
  if (question.type === "RATING") return answer.ratingValue !== null;
  return answer.selectedOptionIds.length > 0;
}
