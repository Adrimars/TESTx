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
