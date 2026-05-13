import type { MediaType, QuestionType } from "../constants";

export type QuestionConfig = Record<string, unknown>;

export type QuestionOption = {
  id: string;
  questionId: string;
  label: string | null;
  mediaId: string | null;
  order: number;
};

export type Question = {
  id: string;
  testId: string;
  type: QuestionType;
  prompt: string;
  mediaType: MediaType | null;
  order: number;
  config: QuestionConfig;
  isAttentionCheck: boolean;
  isTrapDuplicate: boolean;
  trapSourceId: string | null;
  createdAt: string;
  options: QuestionOption[];
};
