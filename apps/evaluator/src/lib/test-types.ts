export type QuestionOption = {
  id: string;
  questionId: string;
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

export type Question = {
  id: string;
  testId: string;
  type: "SINGLE_SELECT" | "MULTI_SELECT" | "RATING" | "ORDERING";
  prompt: string;
  mediaType: string | null;
  order: number;
  config: Record<string, unknown>;
  isReviewHidden: boolean;
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
  questionCount: number;
  questions: Question[];
  /** Opaque, server-signed. Carries the session start time; returned on submit. */
  sessionToken: string;
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
  /** For ORDERING questions this is the ranking, best first; the array order is the answer. */
  selectedOptionIds: string[];
  ratingValue: number | null;
  timeSpentSeconds: number;
  /**
   * Whether the evaluator has actually rearranged an ordering question. Its ranking starts
   * pre-filled with a shuffle, so without this an untouched random order would count as an
   * answer. Local to the session; never submitted.
   */
  orderTouched: boolean;
};
