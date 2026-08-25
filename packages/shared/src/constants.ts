export const USER_ROLES = ["EVALUATOR", "ADMIN"] as const;
export const GENDERS = ["MALE", "FEMALE", "OTHER", "UNDISCLOSED"] as const;
export const TEST_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "CLOSED"] as const;
export const QUESTION_TYPES = ["SINGLE_SELECT", "MULTI_SELECT", "RATING", "ORDERING"] as const;
export const MEDIA_TYPES = ["IMAGE", "VIDEO", "AUDIO", "TEXT"] as const;
export const FILE_MEDIA_TYPES = ["IMAGE", "VIDEO", "AUDIO"] as const;
export const MEDIA_SOURCE_TYPES = ["UPLOAD", "GOOGLE_DRIVE"] as const;

export const DEFAULT_MIN_TIME_PER_QUESTION_SECONDS = 60;

export const EDUCATION_LEVELS = [
  { value: "PRIMARY_MIDDLE", label: "Primary School / Middle School" },
  { value: "HIGH_SCHOOL", label: "High School" },
  { value: "ASSOCIATE", label: "Associate Degree (2 Years)" },
  { value: "BACHELOR", label: "Bachelor's Degree (4 Years)" },
  { value: "MASTER", label: "Master's Degree" },
  { value: "DOCTORATE", label: "Doctorate and Above" },
] as const;

export const AI_USE_CASES = [
  { value: "EDUCATION_RESEARCH", label: "Education and Research (Homework, thesis, literature review)" },
  { value: "SOFTWARE_TECH", label: "Software and Technology (Coding, debugging)" },
  { value: "CONTENT_CREATION", label: "Content Creation (Text, visuals, translation)" },
  { value: "BUSINESS_PRODUCTIVITY", label: "Business and Productivity (Email, summarizing, data analysis)" },
  { value: "ENTERTAINMENT", label: "Entertainment and Daily Life (Chat, games, advice)" },
  { value: "NONE", label: "I don't use it" },
  { value: "OTHER", label: "Other" },
] as const;

export const AI_EXPERIENCE_OPTIONS = [
  { value: "NONE", label: "No experience / Just starting out" },
  { value: "UNDER_6_MONTHS", label: "Less than 6 months" },
  { value: "SIX_TO_12_MONTHS", label: "6 months - 1 year" },
  { value: "ONE_TO_2_YEARS", label: "1 year - 2 years" },
  { value: "OVER_2_YEARS", label: "More than 2 years" },
] as const;

export const AI_FREQUENCY_OPTIONS = [
  { value: "DAILY", label: "Every day" },
  { value: "FEW_TIMES_WEEK", label: "A few times a week" },
  { value: "FEW_TIMES_MONTH", label: "A few times a month" },
  { value: "RARELY", label: "Very rarely" },
  { value: "NEVER", label: "I never use it" },
] as const;

/** Rating scale assumed when a RATING question's config omits `min`/`max`. Matches the evaluator renderer. */
export const DEFAULT_RATING_MIN = 1;
export const DEFAULT_RATING_MAX = 5;

export const QUESTION_REWARD_WEIGHTS: Record<QuestionType, number> = {
  SINGLE_SELECT: 2,
  MULTI_SELECT: 2,
  RATING: 1,
  // Ranking every option is more work than picking one of them.
  ORDERING: 3,
};

export type UserRole = (typeof USER_ROLES)[number];
export type Gender = (typeof GENDERS)[number];
export type TestStatus = (typeof TEST_STATUSES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type MediaType = (typeof MEDIA_TYPES)[number];
export type FileMediaType = (typeof FILE_MEDIA_TYPES)[number];
export type MediaSourceType = (typeof MEDIA_SOURCE_TYPES)[number];
