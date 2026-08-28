export const USER_ROLES = ["EVALUATOR", "ADMIN"] as const;
export const GENDERS = ["MALE", "FEMALE", "OTHER", "UNDISCLOSED"] as const;
export const TEST_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "CLOSED"] as const;
export const QUESTION_TYPES = ["SINGLE_SELECT", "MULTI_SELECT", "RATING", "RANKING"] as const;
export const MEDIA_TYPES = ["IMAGE", "VIDEO", "AUDIO", "TEXT"] as const;
export const FILE_MEDIA_TYPES = ["IMAGE", "VIDEO", "AUDIO"] as const;
export const MEDIA_SOURCE_TYPES = ["UPLOAD", "GOOGLE_DRIVE"] as const;

export const DEFAULT_MIN_TIME_PER_QUESTION_SECONDS = 60;

/**
 * Number of avatar presets bundled with the mobile app. A User.avatarId must be
 * an index below this. There is no avatar upload anywhere in TESTx by design.
 */
export const AVATAR_COUNT = 10;

/**
 * Minimum mobile app version the API will serve, when MOBILE_MIN_APP_VERSION is unset.
 *
 * The question-type set grows over time (Ranking in Phase 13, more later). An older build
 * that does not know how to render a new QuestionType must be forced to update rather than
 * allowed to break mid-feed, so this is bumped as part of shipping any new question type.
 * See plan.md 9.6.
 *
 * It lives here, beside the constants both sides share, rather than inline in the API
 * route: it is a statement about the mobile client, and it must track apps/mobile/app.json's
 * `version` - the two are meaningless apart. The mobile app reads the effective value from
 * GET /mobile/min-version rather than compiling this in, so a deployed API can raise the
 * floor without a new build.
 */
export const DEFAULT_MIN_APP_VERSION = "1.0.0";

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

/**
 * Predecided hobby list (prd.md §16.7) - `EvaluatorProfile.hobbies` is validated
 * server-side against these values, same reasoning as `AI_USE_CASES`: a free-text field
 * here would make "which hobbies are common" unanswerable for targeting/analysis later.
 */
export const HOBBIES = [
  { value: "READING", label: "Reading" },
  { value: "COOKING_BAKING", label: "Cooking & Baking" },
  { value: "GAMING", label: "Gaming" },
  { value: "SPORTS_FITNESS", label: "Sports & Fitness" },
  { value: "TRAVEL", label: "Travel" },
  { value: "PHOTOGRAPHY", label: "Photography" },
  { value: "MUSIC", label: "Music" },
  { value: "MOVIES_TV", label: "Movies & TV" },
  { value: "ART_PAINTING", label: "Art & Painting" },
  { value: "GARDENING", label: "Gardening" },
  { value: "HIKING_OUTDOORS", label: "Hiking & Outdoors" },
  { value: "WRITING", label: "Writing" },
  { value: "YOGA_MEDITATION", label: "Yoga & Meditation" },
  { value: "BOARD_GAMES_PUZZLES", label: "Board Games & Puzzles" },
  { value: "PETS_ANIMALS", label: "Pets & Animals" },
  { value: "DIY_CRAFTS", label: "DIY & Crafts" },
  { value: "FASHION_STYLE", label: "Fashion & Style" },
  { value: "TECHNOLOGY_GADGETS", label: "Technology & Gadgets" },
] as const;

/** Cap on how many hobbies can be selected - read by both `evaluatorProfileSchema`
 * (server-side enforcement) and the chip grid's own `atMax` guard (client-side). */
export const HOBBIES_MAX = 5;

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

/**
 * Endpoint labels shown at the low and high ends of a rating's scale when the admin did
 * not set `minLabel`/`maxLabel`. A rating is a scale, not a ranking - unlike Ranking's
 * best/worst, which end is "better" is never implied by the scale itself, so the
 * direction has to be legible even when the admin left these unset.
 */
export const DEFAULT_RATING_MIN_LABEL = "Low";
export const DEFAULT_RATING_MAX_LABEL = "High";

/**
 * A RANKING question asks for a strict order over all of its options, so the option
 * count is what bounds the work. Below 3 the ordering carries almost no information
 * beyond a single-select; above 5 the mobile drag-to-slot interaction runs out of
 * room for the target column within the safe area.
 */
export const RANKING_MIN_OPTIONS = 3;
export const RANKING_MAX_OPTIONS = 5;

/** Endpoint labels shown at the top and bottom of a ranking's slot column. */
export const DEFAULT_RANKING_BEST_LABEL = "Best";
export const DEFAULT_RANKING_WORST_LABEL = "Worst";

export const QUESTION_REWARD_WEIGHTS: Record<QuestionType, number> = {
  SINGLE_SELECT: 2,
  MULTI_SELECT: 2,
  RATING: 1,
  // Ranking asks for one placement per option rather than one answer per question,
  // so it costs the evaluator more than any of the others.
  RANKING: 3,
};

export type UserRole = (typeof USER_ROLES)[number];
export type Gender = (typeof GENDERS)[number];
export type TestStatus = (typeof TEST_STATUSES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type MediaType = (typeof MEDIA_TYPES)[number];
export type FileMediaType = (typeof FILE_MEDIA_TYPES)[number];
export type MediaSourceType = (typeof MEDIA_SOURCE_TYPES)[number];
