export type AnswerPayload = {
  questionId: string;
  selectedOptionIds?: string[];
  ratingValue?: number;
  textValue?: string;
  timeSpentSeconds: number;
};

export type TestSubmissionPayload = {
  startedAt: string;
  answers: AnswerPayload[];
};

export type TestResponse = {
  id: string;
  testId: string;
  userId: string;
  isFlagged: boolean;
  flagReasons: string[];
  pointsEarned: number;
  startedAt: string;
  completedAt: string;
  totalTimeSeconds: number;
};
