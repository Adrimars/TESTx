export type QuestionOption = {
  id: string;
  questionId: string;
  label: string | null;
  mediaId: string | null;
  order: number;
  mediaUrl: string | null;
};

export type Question = {
  id: string;
  testId: string;
  type: "SINGLE_SELECT" | "MULTI_SELECT" | "RATING" | "FREE_TEXT";
  prompt: string;
  mediaType: string | null;
  order: number;
  config: Record<string, unknown>;
  isAttentionCheck: boolean;
  isTrapDuplicate: boolean;
  trapSourceId: string | null;
  options: QuestionOption[];
};

export type TestDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  advisoryTimeMin: number | null;
  minTimePerQuestion: number;
  rewardPoints: number;
  questions: Question[];
};

export type NextTest = {
  id: string;
  title: string;
  description: string | null;
  advisoryTimeMin: number | null;
  rewardPoints: number;
  minTimePerQuestion: number;
  questionCount: number;
};

export type AnswerData = {
  selectedOptionIds: string[];
  ratingValue: number | null;
  textValue: string;
  timeSpentSeconds: number;
};
