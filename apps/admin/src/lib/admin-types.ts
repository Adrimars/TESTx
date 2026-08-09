import type { Gender, MediaType, QuestionType, TestStatus } from "@testx/shared";

export type AdminMedia = {
  id: string;
  fileName: string;
  fileType: Exclude<MediaType, "TEXT">;
  mimeType: string;
  fileSize: number;
  sourceType: "UPLOAD" | "GOOGLE_DRIVE";
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  tags: string[];
  uploadedAt: string;
  url?: string;
};

export type AdminQuestionOption = {
  id: string;
  questionId: string;
  label: string | null;
  mediaId: string | null;
  order: number;
  media: AdminMedia | null;
  mediaUrl: string | null;
};

export type AdminQuestion = {
  id: string;
  testId: string;
  type: QuestionType;
  prompt: string;
  mediaType: MediaType | null;
  order: number;
  config: Record<string, unknown>;
  isAttentionCheck: boolean;
  isTrapDuplicate: boolean;
  trapSourceId: string | null;
  createdAt: string;
  options: AdminQuestionOption[];
};

export type AdminTestDetail = {
  id: string;
  title: string;
  description: string | null;
  status: TestStatus;
  responseCap: number | null;
  advisoryTimeMin: number | null;
  minTimePerQuestion: number;
  demographicFilters: {
    ageMin?: number;
    ageMax?: number;
    genders?: Gender[];
    countries?: string[];
    cities?: string[];
  } | null;
  rewardPoints: number;
  createdAt: string;
  updatedAt: string;
  questions: AdminQuestion[];
};

export type AdminTestListItem = Omit<AdminTestDetail, "questions"> & {
  questionCount: number;
  responseCount: number;
};

export type TemplateItem = {
  id: string;
  name: string;
  description: string | null;
  structure: unknown;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type DashboardStats = {
  totalEvaluators: number;
  activeTests: number;
  totalResponses: number;
  flaggedResponses: number;
  recentTests: Array<{
    id: string;
    title: string;
    status: TestStatus;
    responseCount: number;
    createdAt: string;
  }>;
};

export type OptionAggregation = {
  optionId: string;
  label: string | null;
  mediaId: string | null;
  mediaUrl: string | null;
  count: number;
  percentage: number;
};

export type RatingAggregation = {
  average: number | null;
  min: number | null;
  max: number | null;
  distribution: Array<{ value: number; count: number }>;
};

export type QuestionResult = {
  questionId: string;
  prompt: string;
  type: QuestionType;
  mediaType: MediaType | null;
  answeredCount: number;
  options?: OptionAggregation[];
  rating?: RatingAggregation;
  textResponses?: string[];
};

export type TestResults = {
  testId: string;
  title: string;
  status: TestStatus;
  totalResponses: number;
  validResponses: number;
  flaggedResponses: number;
  averageCompletionTime: number | null;
  questions: QuestionResult[];
};

export type SegmentBy = "gender" | "ageGroup" | "country";

export type DemographicResults = {
  testId: string;
  title: string;
  segmentBy: SegmentBy;
  segments: Array<{
    label: string;
    responseCount: number;
    questions: QuestionResult[];
  }>;
};

export type EvaluatorListItem = {
  id: string;
  name: string | null;
  email: string;
  registeredAt: string;
  testsCompleted: number;
  totalPoints: number;
};
