export const USER_ROLES = ["EVALUATOR", "ADMIN"] as const;
export const GENDERS = ["MALE", "FEMALE", "OTHER", "UNDISCLOSED"] as const;
export const TEST_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "CLOSED"] as const;
export const QUESTION_TYPES = [
  "SINGLE_SELECT",
  "MULTI_SELECT",
  "RATING",
  "FREE_TEXT",
] as const;
export const MEDIA_TYPES = ["IMAGE", "VIDEO", "AUDIO", "TEXT"] as const;
export const FILE_MEDIA_TYPES = ["IMAGE", "VIDEO", "AUDIO"] as const;
export const MEDIA_SOURCE_TYPES = ["UPLOAD", "GOOGLE_DRIVE"] as const;

export const DEFAULT_MIN_TIME_PER_QUESTION_SECONDS = 60;

export const QUESTION_REWARD_WEIGHTS: Record<QuestionType, number> = {
  SINGLE_SELECT: 2,
  MULTI_SELECT: 2,
  RATING: 1,
  FREE_TEXT: 3,
};

export type UserRole = (typeof USER_ROLES)[number];
export type Gender = (typeof GENDERS)[number];
export type TestStatus = (typeof TEST_STATUSES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type MediaType = (typeof MEDIA_TYPES)[number];
export type FileMediaType = (typeof FILE_MEDIA_TYPES)[number];
export type MediaSourceType = (typeof MEDIA_SOURCE_TYPES)[number];
