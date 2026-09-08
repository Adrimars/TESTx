import { Prisma, type PrismaClient } from "@testx/database";
import { AGE_GROUPS, ageGroup, type QuestionType } from "@testx/shared";

/**
 * Aggregates in SQL rather than loading every `TestResponse`/`Answer` into Node memory
 * (plan.md 17.3 / OPTIMIZATIONS.md Finding 4) — for a popular test, the old approach
 * turned one page load into a multi-second, memory-heavy query. Every function here is
 * built to return the exact same shape and numbers the old in-memory version did; see
 * the per-type comments below for the specific semantics being preserved (denominators,
 * zero-filled options/scale values, flagged/attention-check exclusion).
 */

const scoredQuestionInclude = {
  where: { isAttentionCheck: false, isTrapDuplicate: false },
  orderBy: { order: "asc" },
  include: { options: { orderBy: { order: "asc" } } },
} satisfies Prisma.Test$questionsArgs;

const testWithScoredQuestions = {
  questions: scoredQuestionInclude,
} satisfies Prisma.TestInclude;

type TestWithQuestions = Prisma.TestGetPayload<{ include: typeof testWithScoredQuestions }>;
type ResultQuestion = TestWithQuestions["questions"][number];

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

export type RankingAggregation = {
  /** One entry per option, best average rank first. */
  ranks: Array<{
    optionId: string;
    label: string | null;
    mediaId: string | null;
    mediaUrl: string | null;
    /** 1-based mean position across responses; null when nobody ranked the question. */
    averageRank: number | null;
    /** How many evaluators put this option in each position, index 0 = first place. */
    positionCounts: number[];
  }>;
};

export type QuestionResult = {
  questionId: string;
  prompt: string;
  type: QuestionType;
  mediaType: ResultQuestion["mediaType"];
  /** The media the question was about, if any — the image rated, the clip ranked. */
  mediaId: string | null;
  mediaUrl: string | null;
  answeredCount: number;
  options?: OptionAggregation[];
  rating?: RatingAggregation;
  ranking?: RankingAggregation;
};

export type SegmentBy = "gender" | "ageGroup" | "country";

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------
// Raw SQL row shapes. All numeric aggregates are cast in SQL (`::int` for
// counts/sums, `::double precision` for averages) so Prisma hands back plain
// JS numbers rather than bigint/Decimal — see plan.md 17.3's note on this.
// ---------------------------------------------------------------------------

type BaseStatRow = {
  questionId: string;
  answeredCount: number;
  totalSelections: number;
  ratingSum: number | null;
  ratingCount: number;
  minRating: number | null;
  maxRating: number | null;
};

type OptionCountRow = { questionId: string; optionId: string; count: number };
type RankRow = { questionId: string; optionId: string; position: number; count: number };
type RatingDistRow = { questionId: string; value: number; count: number };

async function fetchBaseStats(prisma: PrismaClient, questionIds: string[]): Promise<BaseStatRow[]> {
  if (questionIds.length === 0) return [];
  return prisma.$queryRaw<BaseStatRow[]>(Prisma.sql`
    SELECT
      a."questionId" AS "questionId",
      COUNT(*)::int AS "answeredCount",
      SUM(cardinality(a."selectedOptions"))::int AS "totalSelections",
      SUM(a."ratingValue")::double precision AS "ratingSum",
      COUNT(a."ratingValue")::int AS "ratingCount",
      MIN(a."ratingValue") AS "minRating",
      MAX(a."ratingValue") AS "maxRating"
    FROM "Answer" a
    JOIN "TestResponse" r ON r.id = a."responseId"
    WHERE a."questionId" = ANY(${questionIds}::uuid[]) AND r."isFlagged" = false
    GROUP BY a."questionId"
  `);
}

async function fetchOptionCounts(prisma: PrismaClient, questionIds: string[]): Promise<OptionCountRow[]> {
  if (questionIds.length === 0) return [];
  return prisma.$queryRaw<OptionCountRow[]>(Prisma.sql`
    SELECT
      a."questionId" AS "questionId",
      opt::text AS "optionId",
      COUNT(*)::int AS count
    FROM "Answer" a
    JOIN "TestResponse" r ON r.id = a."responseId"
    CROSS JOIN LATERAL unnest(a."selectedOptions") AS opt
    WHERE a."questionId" = ANY(${questionIds}::uuid[]) AND r."isFlagged" = false
    GROUP BY a."questionId", opt
  `);
}

/**
 * `selectedOptions`'s array order *is* the rank (best first) for RANKING answers — see
 * the `Answer.selectedOptions` schema comment. `WITH ORDINALITY` recovers each option's
 * 1-based position; the inner join to `QuestionOption` drops any option id that isn't
 * (or no longer is) one of this question's current options, matching the old code's
 * `if (!slots) return` guard.
 */
async function fetchRankPositions(prisma: PrismaClient, questionIds: string[]): Promise<RankRow[]> {
  if (questionIds.length === 0) return [];
  return prisma.$queryRaw<RankRow[]>(Prisma.sql`
    SELECT
      a."questionId" AS "questionId",
      qo.id::text AS "optionId",
      t.ord::int AS position,
      COUNT(*)::int AS count
    FROM "Answer" a
    JOIN "TestResponse" r ON r.id = a."responseId"
    CROSS JOIN LATERAL unnest(a."selectedOptions") WITH ORDINALITY AS t(elem, ord)
    JOIN "QuestionOption" qo ON qo.id = t.elem AND qo."questionId" = a."questionId"
    WHERE a."questionId" = ANY(${questionIds}::uuid[]) AND r."isFlagged" = false
    GROUP BY a."questionId", qo.id, t.ord
  `);
}

async function fetchRatingDistribution(prisma: PrismaClient, questionIds: string[]): Promise<RatingDistRow[]> {
  if (questionIds.length === 0) return [];
  return prisma.$queryRaw<RatingDistRow[]>(Prisma.sql`
    SELECT
      a."questionId" AS "questionId",
      a."ratingValue" AS value,
      COUNT(*)::int AS count
    FROM "Answer" a
    JOIN "TestResponse" r ON r.id = a."responseId"
    WHERE a."questionId" = ANY(${questionIds}::uuid[]) AND r."isFlagged" = false AND a."ratingValue" IS NOT NULL
    GROUP BY a."questionId", a."ratingValue"
  `);
}

function aggregateQuestion(
  question: ResultQuestion,
  base: BaseStatRow | undefined,
  optionCounts: Map<string, number>,
  rankRows: RankRow[],
  ratingDist: Map<number, number>
): QuestionResult {
  const answeredCount = base?.answeredCount ?? 0;
  const result: QuestionResult = {
    questionId: question.id,
    prompt: question.prompt,
    type: question.type,
    mediaType: question.mediaType,
    mediaId: question.mediaId,
    mediaUrl: question.mediaId ? `/media/${question.mediaId}/file` : null,
    answeredCount,
  };

  if (question.type === "SINGLE_SELECT" || question.type === "MULTI_SELECT") {
    // SINGLE_SELECT's percentage is of respondents (`answeredCount`); MULTI_SELECT's is
    // of total selections made (`totalSelections`) — these differ on purpose.
    const denominator = question.type === "MULTI_SELECT" ? (base?.totalSelections ?? 0) : answeredCount;
    result.options = question.options.map((option) => {
      const count = optionCounts.get(option.id) ?? 0;
      return {
        optionId: option.id,
        label: option.label,
        mediaId: option.mediaId,
        mediaUrl: option.mediaId ? `/media/${option.mediaId}/file` : null,
        count,
        percentage: denominator > 0 ? round((count / denominator) * 100) : 0,
      };
    });
    return result;
  }

  if (question.type === "RANKING") {
    const optionCount = question.options.length;
    const rankSums = new Map<string, number>();
    const rankCounts = new Map<string, number>();
    const positions = new Map<string, number[]>();
    for (const option of question.options) {
      positions.set(option.id, new Array<number>(optionCount).fill(0));
    }

    for (const row of rankRows) {
      // Mirrors the old code's `index >= optionCount` guard — a stray position beyond
      // the question's current option count is dropped rather than counted.
      if (row.position > optionCount) continue;
      const slots = positions.get(row.optionId);
      if (!slots) continue;
      slots[row.position - 1] = (slots[row.position - 1] ?? 0) + row.count;
      rankSums.set(row.optionId, (rankSums.get(row.optionId) ?? 0) + row.position * row.count);
      rankCounts.set(row.optionId, (rankCounts.get(row.optionId) ?? 0) + row.count);
    }

    const ranks = question.options.map((option) => {
      const count = rankCounts.get(option.id) ?? 0;
      return {
        optionId: option.id,
        label: option.label,
        mediaId: option.mediaId,
        mediaUrl: option.mediaId ? `/media/${option.mediaId}/file` : null,
        averageRank: count > 0 ? round((rankSums.get(option.id) ?? 0) / count) : null,
        positionCounts: positions.get(option.id) ?? [],
      };
    });

    // Best average rank first — an unranked option sorts last rather than ahead of everything.
    ranks.sort((a, b) => (a.averageRank ?? Infinity) - (b.averageRank ?? Infinity));
    result.ranking = { ranks };
    return result;
  }

  if (question.type === "RATING") {
    const config = (question.config ?? {}) as Record<string, unknown>;
    const scaleMin = typeof config.min === "number" ? config.min : 1;
    const scaleMax = typeof config.max === "number" ? config.max : 5;

    const distribution: Array<{ value: number; count: number }> = [];
    for (let value = scaleMin; value <= scaleMax; value += 1) {
      distribution.push({ value, count: ratingDist.get(value) ?? 0 });
    }

    const ratingCount = base?.ratingCount ?? 0;
    result.rating = {
      average: ratingCount > 0 ? round((base?.ratingSum ?? 0) / ratingCount) : null,
      min: base?.minRating ?? null,
      max: base?.maxRating ?? null,
      distribution,
    };
    return result;
  }

  return result;
}

function buildQuestionResults(
  questions: ResultQuestion[],
  baseStats: BaseStatRow[],
  optionCountRows: OptionCountRow[],
  rankRows: RankRow[],
  ratingDistRows: RatingDistRow[]
): QuestionResult[] {
  const baseByQuestion = new Map(baseStats.map((row) => [row.questionId, row]));

  const optionCountsByQuestion = new Map<string, Map<string, number>>();
  for (const row of optionCountRows) {
    const bucket = optionCountsByQuestion.get(row.questionId) ?? new Map<string, number>();
    bucket.set(row.optionId, row.count);
    optionCountsByQuestion.set(row.questionId, bucket);
  }

  const rankRowsByQuestion = new Map<string, RankRow[]>();
  for (const row of rankRows) {
    const bucket = rankRowsByQuestion.get(row.questionId);
    if (bucket) bucket.push(row);
    else rankRowsByQuestion.set(row.questionId, [row]);
  }

  const ratingDistByQuestion = new Map<string, Map<number, number>>();
  for (const row of ratingDistRows) {
    const bucket = ratingDistByQuestion.get(row.questionId) ?? new Map<number, number>();
    bucket.set(row.value, row.count);
    ratingDistByQuestion.set(row.questionId, bucket);
  }

  return questions.map((question) =>
    aggregateQuestion(
      question,
      baseByQuestion.get(question.id),
      optionCountsByQuestion.get(question.id) ?? new Map(),
      rankRowsByQuestion.get(question.id) ?? [],
      ratingDistByQuestion.get(question.id) ?? new Map()
    )
  );
}

export async function getTestResults(prisma: PrismaClient, testId: string) {
  const test = await prisma.test.findUnique({ where: { id: testId }, include: testWithScoredQuestions });
  if (!test) return null;

  const questionIds = test.questions.map((q) => q.id);

  const [totalResponses, validAgg, baseStats, optionCountRows, rankRows, ratingDistRows] = await Promise.all([
    prisma.testResponse.count({ where: { testId } }),
    prisma.testResponse.aggregate({
      where: { testId, isFlagged: false },
      _count: { _all: true },
      _avg: { totalTimeSeconds: true },
    }),
    fetchBaseStats(prisma, questionIds),
    fetchOptionCounts(prisma, questionIds),
    fetchRankPositions(prisma, questionIds),
    fetchRatingDistribution(prisma, questionIds),
  ]);

  const validResponses = validAgg._count._all;
  const flaggedResponses = totalResponses - validResponses;
  const averageCompletionTime =
    validResponses > 0 && validAgg._avg.totalTimeSeconds !== null
      ? Math.round(validAgg._avg.totalTimeSeconds)
      : null;

  return {
    testId: test.id,
    title: test.title,
    status: test.status,
    totalResponses,
    validResponses,
    flaggedResponses,
    averageCompletionTime,
    questions: buildQuestionResults(test.questions, baseStats, optionCountRows, rankRows, ratingDistRows),
  };
}

// ---------------------------------------------------------------------------
// Demographic segmentation
// ---------------------------------------------------------------------------

/**
 * The raw grouping column for each segment dimension. `ageGroup` groups by raw `age`
 * (bucketing into `AGE_GROUPS` happens in JS afterward, via `foldBySegment` below) —
 * grouping directly by the bucket in SQL isn't safe, since two different ages can share
 * a bucket and an aggregate like AVG can't be re-combined after the fact, only SUM/COUNT
 * pairs can. `gender`/`country` group directly; their raw key already *is* the label.
 */
function segmentKeyExpr(segmentBy: SegmentBy): Prisma.Sql {
  if (segmentBy === "gender") return Prisma.sql`ep."gender"::text`;
  if (segmentBy === "country") return Prisma.sql`ep."country"`;
  return Prisma.sql`ep."age"::text`;
}

function toBucketLabel(segmentBy: SegmentBy, rawKey: string): string {
  return segmentBy === "ageGroup" ? ageGroup(Number(rawKey)) : rawKey;
}

/**
 * Folds raw per-segment-key rows down to one row per (final bucket label, `subKey`),
 * summing `count`-like fields with `merge`. For `gender`/`country` every raw key is
 * already its own final label, so this is a no-op pass-through; for `ageGroup` it's
 * where multiple ages sharing a bucket (e.g. 25 and 31 → "25-34") get combined.
 */
function foldBySegment<T extends { segmentKey: string }>(
  rows: T[],
  segmentBy: SegmentBy,
  subKey: (row: T) => string,
  merge: (a: T, b: T) => T
): T[] {
  const merged = new Map<string, T>();
  for (const row of rows) {
    const label = toBucketLabel(segmentBy, row.segmentKey);
    const bucketed = { ...row, segmentKey: label };
    const key = `${label} ${subKey(row)}`;
    const existing = merged.get(key);
    merged.set(key, existing ? merge(existing, bucketed) : bucketed);
  }
  return [...merged.values()];
}

function minOrNull(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function maxOrNull(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

type SegmentedRow<T> = T & { segmentKey: string };

async function fetchDemographicResponseCounts(
  prisma: PrismaClient,
  testId: string,
  segmentBy: SegmentBy
): Promise<SegmentedRow<{ count: number }>[]> {
  const seg = segmentKeyExpr(segmentBy);
  return prisma.$queryRaw<SegmentedRow<{ count: number }>[]>(Prisma.sql`
    SELECT ${seg} AS "segmentKey", COUNT(*)::int AS count
    FROM "TestResponse" r
    JOIN "EvaluatorProfile" ep ON ep."userId" = r."userId"
    WHERE r."testId" = ${testId}::uuid AND r."isFlagged" = false
    GROUP BY ${seg}
  `);
}

async function fetchDemographicBaseStats(
  prisma: PrismaClient,
  questionIds: string[],
  segmentBy: SegmentBy
): Promise<SegmentedRow<BaseStatRow>[]> {
  if (questionIds.length === 0) return [];
  const seg = segmentKeyExpr(segmentBy);
  return prisma.$queryRaw<SegmentedRow<BaseStatRow>[]>(Prisma.sql`
    SELECT
      a."questionId" AS "questionId",
      ${seg} AS "segmentKey",
      COUNT(*)::int AS "answeredCount",
      SUM(cardinality(a."selectedOptions"))::int AS "totalSelections",
      SUM(a."ratingValue")::double precision AS "ratingSum",
      COUNT(a."ratingValue")::int AS "ratingCount",
      MIN(a."ratingValue") AS "minRating",
      MAX(a."ratingValue") AS "maxRating"
    FROM "Answer" a
    JOIN "TestResponse" r ON r.id = a."responseId"
    JOIN "EvaluatorProfile" ep ON ep."userId" = r."userId"
    WHERE a."questionId" = ANY(${questionIds}::uuid[]) AND r."isFlagged" = false
    GROUP BY a."questionId", ${seg}
  `);
}

async function fetchDemographicOptionCounts(
  prisma: PrismaClient,
  questionIds: string[],
  segmentBy: SegmentBy
): Promise<SegmentedRow<OptionCountRow>[]> {
  if (questionIds.length === 0) return [];
  const seg = segmentKeyExpr(segmentBy);
  return prisma.$queryRaw<SegmentedRow<OptionCountRow>[]>(Prisma.sql`
    SELECT
      a."questionId" AS "questionId",
      opt::text AS "optionId",
      ${seg} AS "segmentKey",
      COUNT(*)::int AS count
    FROM "Answer" a
    JOIN "TestResponse" r ON r.id = a."responseId"
    JOIN "EvaluatorProfile" ep ON ep."userId" = r."userId"
    CROSS JOIN LATERAL unnest(a."selectedOptions") AS opt
    WHERE a."questionId" = ANY(${questionIds}::uuid[]) AND r."isFlagged" = false
    GROUP BY a."questionId", opt, ${seg}
  `);
}

async function fetchDemographicRankPositions(
  prisma: PrismaClient,
  questionIds: string[],
  segmentBy: SegmentBy
): Promise<SegmentedRow<RankRow>[]> {
  if (questionIds.length === 0) return [];
  const seg = segmentKeyExpr(segmentBy);
  return prisma.$queryRaw<SegmentedRow<RankRow>[]>(Prisma.sql`
    SELECT
      a."questionId" AS "questionId",
      qo.id::text AS "optionId",
      t.ord::int AS position,
      ${seg} AS "segmentKey",
      COUNT(*)::int AS count
    FROM "Answer" a
    JOIN "TestResponse" r ON r.id = a."responseId"
    JOIN "EvaluatorProfile" ep ON ep."userId" = r."userId"
    CROSS JOIN LATERAL unnest(a."selectedOptions") WITH ORDINALITY AS t(elem, ord)
    JOIN "QuestionOption" qo ON qo.id = t.elem AND qo."questionId" = a."questionId"
    WHERE a."questionId" = ANY(${questionIds}::uuid[]) AND r."isFlagged" = false
    GROUP BY a."questionId", qo.id, t.ord, ${seg}
  `);
}

async function fetchDemographicRatingDistribution(
  prisma: PrismaClient,
  questionIds: string[],
  segmentBy: SegmentBy
): Promise<SegmentedRow<RatingDistRow>[]> {
  if (questionIds.length === 0) return [];
  const seg = segmentKeyExpr(segmentBy);
  return prisma.$queryRaw<SegmentedRow<RatingDistRow>[]>(Prisma.sql`
    SELECT
      a."questionId" AS "questionId",
      a."ratingValue" AS value,
      ${seg} AS "segmentKey",
      COUNT(*)::int AS count
    FROM "Answer" a
    JOIN "TestResponse" r ON r.id = a."responseId"
    JOIN "EvaluatorProfile" ep ON ep."userId" = r."userId"
    WHERE a."questionId" = ANY(${questionIds}::uuid[]) AND r."isFlagged" = false AND a."ratingValue" IS NOT NULL
    GROUP BY a."questionId", a."ratingValue", ${seg}
  `);
}

export async function getTestResultsByDemographic(
  prisma: PrismaClient,
  testId: string,
  segmentBy: SegmentBy
) {
  const test = await prisma.test.findUnique({ where: { id: testId }, include: testWithScoredQuestions });
  if (!test) return null;

  const questionIds = test.questions.map((q) => q.id);

  const [responseCountRows, baseStatRows, optionCountRows, rankRows, ratingDistRows] = await Promise.all([
    fetchDemographicResponseCounts(prisma, testId, segmentBy),
    fetchDemographicBaseStats(prisma, questionIds, segmentBy),
    fetchDemographicOptionCounts(prisma, questionIds, segmentBy),
    fetchDemographicRankPositions(prisma, questionIds, segmentBy),
    fetchDemographicRatingDistribution(prisma, questionIds, segmentBy),
  ]);

  const foldedResponseCounts = foldBySegment(
    responseCountRows,
    segmentBy,
    () => "",
    (a, b) => ({ ...a, count: a.count + b.count })
  );
  const foldedBaseStats = foldBySegment(
    baseStatRows,
    segmentBy,
    (row) => row.questionId,
    (a, b) => ({
      ...a,
      answeredCount: a.answeredCount + b.answeredCount,
      totalSelections: a.totalSelections + b.totalSelections,
      ratingSum: (a.ratingSum ?? 0) + (b.ratingSum ?? 0),
      ratingCount: a.ratingCount + b.ratingCount,
      minRating: minOrNull(a.minRating, b.minRating),
      maxRating: maxOrNull(a.maxRating, b.maxRating),
    })
  );
  const foldedOptionCounts = foldBySegment(
    optionCountRows,
    segmentBy,
    (row) => `${row.questionId} ${row.optionId}`,
    (a, b) => ({ ...a, count: a.count + b.count })
  );
  const foldedRankRows = foldBySegment(
    rankRows,
    segmentBy,
    (row) => `${row.questionId} ${row.optionId} ${row.position}`,
    (a, b) => ({ ...a, count: a.count + b.count })
  );
  const foldedRatingDist = foldBySegment(
    ratingDistRows,
    segmentBy,
    (row) => `${row.questionId} ${row.value}`,
    (a, b) => ({ ...a, count: a.count + b.count })
  );

  const present = new Set(foldedResponseCounts.map((row) => row.segmentKey));
  const labels =
    segmentBy === "ageGroup"
      ? AGE_GROUPS.filter((label) => present.has(label))
      : Array.from(present).sort();

  const responseCountByLabel = new Map(foldedResponseCounts.map((row) => [row.segmentKey, row.count]));

  const segments = labels.map((label) => {
    const baseForLabel = foldedBaseStats.filter((row) => row.segmentKey === label);
    const optionCountsForLabel = foldedOptionCounts.filter((row) => row.segmentKey === label);
    const rankRowsForLabel = foldedRankRows.filter((row) => row.segmentKey === label);
    const ratingDistForLabel = foldedRatingDist.filter((row) => row.segmentKey === label);

    return {
      label,
      responseCount: responseCountByLabel.get(label) ?? 0,
      questions: buildQuestionResults(
        test.questions,
        baseForLabel,
        optionCountsForLabel,
        rankRowsForLabel,
        ratingDistForLabel
      ),
    };
  });

  return {
    testId: test.id,
    title: test.title,
    segmentBy,
    segments,
  };
}
