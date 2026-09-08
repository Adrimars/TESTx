/**
 * Differential + performance check for plan.md 17.3's SQL rewrite of
 * `results.service.ts`'s `getTestResults`/`getTestResultsByDemographic`.
 *
 * There are no automated tests in this repo, so "the SQL rewrite preserves the old
 * in-memory aggregation's exact semantics" has no safety net other than this script:
 * it seeds a temporary test with a large, varied set of responses (covering every
 * question type, flagged responses, attention-check/trap questions, evaluators with no
 * profile, and RATING answers with a null ratingValue), runs the new SQL-based
 * implementation from `../src/services/results.service` and a self-contained copy of
 * the OLD in-memory implementation (preserved here for exactly this comparison, not used
 * anywhere else) against the same data, and deep-compares the two outputs field by field.
 *
 * Usage (needs a real Postgres reachable via DATABASE_URL — this creates and then
 * deletes real rows):
 *   pnpm --filter @testx/api verify:results
 *   VERIFY_RESPONSE_COUNT=10000 pnpm --filter @testx/api verify:results   # perf exit criterion
 *   SKIP_CLEANUP=1 pnpm --filter @testx/api verify:results                # inspect the seeded test after
 *
 * Exits non-zero (and prints the first mismatching path) if the two disagree on anything.
 */
import { randomUUID } from "node:crypto";
import { inspect } from "node:util";
import { PrismaClient, Prisma } from "@testx/database";
import { AGE_GROUPS, ageGroup } from "@testx/shared";
import { getTestResults, getTestResultsByDemographic, type SegmentBy } from "../src/services/results.service";

const prisma = new PrismaClient();

const RESPONSE_COUNT = Number(process.env.VERIFY_RESPONSE_COUNT ?? 2000);
const SKIP_CLEANUP = process.env.SKIP_CLEANUP === "1";
const BATCH_SIZE = 1000;

// ---------------------------------------------------------------------------
// Legacy reference implementation — a straight copy of the pre-17.3 in-memory
// aggregation, kept ONLY so this script has something to diff the new SQL
// version against. Not exported, not used by the app.
// ---------------------------------------------------------------------------

const scoredQuestionInclude = {
  where: { isAttentionCheck: false, isTrapDuplicate: false },
  orderBy: { order: "asc" },
  include: { options: { orderBy: { order: "asc" } } },
} satisfies Prisma.Test$questionsArgs;

const legacyOverallInclude = {
  questions: scoredQuestionInclude,
  responses: { include: { answers: true } },
} satisfies Prisma.TestInclude;

const legacyDemographicInclude = {
  questions: scoredQuestionInclude,
  responses: {
    include: { answers: true, user: { include: { evaluatorProfile: true } } },
  },
} satisfies Prisma.TestInclude;

type LegacyOverallTest = Prisma.TestGetPayload<{ include: typeof legacyOverallInclude }>;
type LegacyDemographicTest = Prisma.TestGetPayload<{ include: typeof legacyDemographicInclude }>;
type LegacyQuestion = LegacyOverallTest["questions"][number];
type LegacyAnswer = Prisma.AnswerGetPayload<Record<string, never>>;
type LegacyDemoResponse = LegacyDemographicTest["responses"][number];

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function legacyAggregateQuestion(question: LegacyQuestion, answers: LegacyAnswer[]) {
  const base = {
    questionId: question.id,
    prompt: question.prompt,
    type: question.type,
    mediaType: question.mediaType,
    mediaId: question.mediaId,
    mediaUrl: question.mediaId ? `/media/${question.mediaId}/file` : null,
    answeredCount: answers.length,
  } as Record<string, unknown>;

  if (question.type === "SINGLE_SELECT" || question.type === "MULTI_SELECT") {
    const counts = new Map<string, number>();
    let totalSelections = 0;
    for (const answer of answers) {
      for (const optionId of answer.selectedOptions) {
        counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
        totalSelections += 1;
      }
    }
    const denominator = question.type === "MULTI_SELECT" ? totalSelections : answers.length;
    base.options = question.options.map((option) => {
      const count = counts.get(option.id) ?? 0;
      return {
        optionId: option.id,
        label: option.label,
        mediaId: option.mediaId,
        mediaUrl: option.mediaId ? `/media/${option.mediaId}/file` : null,
        count,
        percentage: denominator > 0 ? round((count / denominator) * 100) : 0,
      };
    });
    return base;
  }

  if (question.type === "RANKING") {
    const optionCount = question.options.length;
    const rankSums = new Map<string, number>();
    const rankCounts = new Map<string, number>();
    const positions = new Map<string, number[]>();
    for (const option of question.options) {
      positions.set(option.id, new Array<number>(optionCount).fill(0));
    }
    for (const answer of answers) {
      answer.selectedOptions.forEach((optionId, index) => {
        const slots = positions.get(optionId);
        if (!slots || index >= optionCount) return;
        slots[index] = (slots[index] ?? 0) + 1;
        rankSums.set(optionId, (rankSums.get(optionId) ?? 0) + index + 1);
        rankCounts.set(optionId, (rankCounts.get(optionId) ?? 0) + 1);
      });
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
    ranks.sort((a, b) => (a.averageRank ?? Infinity) - (b.averageRank ?? Infinity));
    base.ranking = { ranks };
    return base;
  }

  if (question.type === "RATING") {
    const config = (question.config ?? {}) as Record<string, unknown>;
    const scaleMin = typeof config.min === "number" ? config.min : 1;
    const scaleMax = typeof config.max === "number" ? config.max : 5;
    const values = answers
      .map((answer) => answer.ratingValue)
      .filter((value): value is number => typeof value === "number");
    const distribution: Array<{ value: number; count: number }> = [];
    for (let value = scaleMin; value <= scaleMax; value += 1) {
      distribution.push({ value, count: values.filter((item) => item === value).length });
    }
    let sum = 0;
    let min: number | null = null;
    let max: number | null = null;
    for (const value of values) {
      sum += value;
      if (min === null || value < min) min = value;
      if (max === null || value > max) max = value;
    }
    base.rating = {
      average: values.length > 0 ? round(sum / values.length) : null,
      min,
      max,
      distribution,
    };
    return base;
  }

  return base;
}

function legacyAggregateQuestions(questions: LegacyQuestion[], responses: Array<{ answers: LegacyAnswer[] }>) {
  const answersByQuestion = new Map<string, LegacyAnswer[]>();
  for (const response of responses) {
    for (const answer of response.answers) {
      const bucket = answersByQuestion.get(answer.questionId);
      if (bucket) bucket.push(answer);
      else answersByQuestion.set(answer.questionId, [answer]);
    }
  }
  return questions.map((question) => legacyAggregateQuestion(question, answersByQuestion.get(question.id) ?? []));
}

function legacySegmentLabel(response: LegacyDemoResponse, segmentBy: SegmentBy): string | null {
  const profile = response.user.evaluatorProfile;
  if (!profile) return null;
  if (segmentBy === "gender") return profile.gender;
  if (segmentBy === "country") return profile.country;
  return ageGroup(profile.age);
}

function legacyOrderedSegmentLabels(segmentBy: SegmentBy, present: Set<string>): string[] {
  if (segmentBy === "ageGroup") return AGE_GROUPS.filter((label) => present.has(label));
  return Array.from(present).sort();
}

async function legacyGetTestResults(testId: string) {
  const test = await prisma.test.findUnique({ where: { id: testId }, include: legacyOverallInclude });
  if (!test) return null;
  const validResponses = test.responses.filter((r) => !r.isFlagged);
  const flaggedCount = test.responses.length - validResponses.length;
  const completionTimes = validResponses.map((r) => r.totalTimeSeconds);
  const averageCompletionTime =
    completionTimes.length > 0
      ? Math.round(completionTimes.reduce((sum, v) => sum + v, 0) / completionTimes.length)
      : null;
  return {
    testId: test.id,
    title: test.title,
    status: test.status,
    totalResponses: test.responses.length,
    validResponses: validResponses.length,
    flaggedResponses: flaggedCount,
    averageCompletionTime,
    questions: legacyAggregateQuestions(test.questions, validResponses),
  };
}

async function legacyGetTestResultsByDemographic(testId: string, segmentBy: SegmentBy) {
  const test = await prisma.test.findUnique({ where: { id: testId }, include: legacyDemographicInclude });
  if (!test) return null;
  const validResponses = test.responses.filter((r) => !r.isFlagged);
  const grouped = new Map<string, LegacyDemoResponse[]>();
  for (const response of validResponses) {
    const label = legacySegmentLabel(response, segmentBy);
    if (!label) continue;
    const bucket = grouped.get(label);
    if (bucket) bucket.push(response);
    else grouped.set(label, [response]);
  }
  const labels = legacyOrderedSegmentLabels(segmentBy, new Set(grouped.keys()));
  return {
    testId: test.id,
    title: test.title,
    segmentBy,
    segments: labels.map((label) => {
      const responses = grouped.get(label) ?? [];
      return {
        label,
        responseCount: responses.length,
        questions: legacyAggregateQuestions(test.questions, responses),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

const COUNTRIES = ["Turkiye", "Germany", "United States", "Brazil"];
const GENDERS = ["MALE", "FEMALE", "OTHER", "UNDISCLOSED"] as const;
// Deliberately at least two ages per AGE_GROUPS bucket, so the demographic fold path
// (multiple raw ages -> one bucket) is actually exercised, not just the 1:1 case.
const AGES = [16, 17, 19, 22, 26, 31, 36, 42, 47, 52, 56, 63];

type Seeded = {
  testId: string;
  singleSelectQuestionId: string;
  multiSelectQuestionId: string;
  ratingQuestionId: string;
  rankingQuestionId: string;
  singleSelectOptionIds: string[];
  multiSelectOptionIds: string[];
  rankingOptionIds: string[];
  userIds: string[];
  userIdsWithoutProfile: string[];
};

async function seed(): Promise<Seeded> {
  const testId = randomUUID();
  await prisma.test.create({
    data: {
      id: testId,
      title: "[verify-results-aggregation] temporary",
      status: "CLOSED",
      minTimePerQuestion: 1,
    },
  });

  const singleSelectQuestionId = randomUUID();
  const multiSelectQuestionId = randomUUID();
  const ratingQuestionId = randomUUID();
  const rankingQuestionId = randomUUID();
  const attentionCheckQuestionId = randomUUID();
  const trapDuplicateQuestionId = randomUUID();
  // Answered by nobody, on purpose — exercises the `base === undefined` path (a question
  // with zero rows in every aggregate query, not just zero for one option/rating value).
  const unansweredRatingQuestionId = randomUUID();

  await prisma.question.createMany({
    data: [
      { id: singleSelectQuestionId, testId, type: "SINGLE_SELECT", prompt: "Single?", order: 1 },
      { id: multiSelectQuestionId, testId, type: "MULTI_SELECT", prompt: "Multi?", order: 2 },
      {
        id: ratingQuestionId,
        testId,
        type: "RATING",
        prompt: "Rate?",
        // max: 7 while answers only ever use 1-5 (see below) so the distribution's
        // zero-fill for untouched scale values is actually exercised.
        order: 3,
        config: { min: 1, max: 7 },
      },
      { id: rankingQuestionId, testId, type: "RANKING", prompt: "Rank?", order: 4 },
      {
        id: attentionCheckQuestionId,
        testId,
        type: "SINGLE_SELECT",
        prompt: "Attention check",
        order: 5,
        isAttentionCheck: true,
      },
      {
        id: trapDuplicateQuestionId,
        testId,
        type: "SINGLE_SELECT",
        prompt: "Single? (trap)",
        order: 6,
        isTrapDuplicate: true,
        trapSourceId: singleSelectQuestionId,
      },
      {
        id: unansweredRatingQuestionId,
        testId,
        type: "RATING",
        prompt: "Rate? (unanswered)",
        order: 7,
        config: { min: 1, max: 5 },
      },
    ],
  });

  // One extra option in each of these that no answer ever selects/ranks, so the
  // zero-count-option fold-back onto `question.options` is exercised too (a naive
  // GROUP BY would otherwise silently omit options nobody picked).
  const singleSelectOptionIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const multiSelectOptionIds = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  const rankingOptionIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const attentionCheckOptionIds = [randomUUID(), randomUUID()];
  const trapDuplicateOptionIds = singleSelectOptionIds.map(() => randomUUID());

  await prisma.questionOption.createMany({
    data: [
      ...singleSelectOptionIds.map((id, i) => ({ id, questionId: singleSelectQuestionId, label: `S${i}`, order: i })),
      ...multiSelectOptionIds.map((id, i) => ({ id, questionId: multiSelectQuestionId, label: `M${i}`, order: i })),
      ...rankingOptionIds.map((id, i) => ({ id, questionId: rankingQuestionId, label: `R${i}`, order: i })),
      ...attentionCheckOptionIds.map((id, i) => ({
        id,
        questionId: attentionCheckQuestionId,
        label: `A${i}`,
        order: i,
      })),
      ...trapDuplicateOptionIds.map((id, i) => ({
        id,
        questionId: trapDuplicateQuestionId,
        label: `S${i}`,
        order: i,
      })),
    ],
  });

  // Users: a grid of (gender x country x age) combos, each with several evaluators, plus
  // a handful with no EvaluatorProfile at all (must count in getTestResults' overall
  // totals but be silently excluded from every demographic segment).
  const userIds: string[] = [];
  const profiles: Prisma.EvaluatorProfileCreateManyInput[] = [];
  const users: Prisma.UserCreateManyInput[] = [];

  // Cycles the (gender x country x age) grid as many times as needed (one user per combo
  // per round) rather than a fixed users-per-combo count, so RESPONSE_COUNT is actually
  // reached even when it's much larger than the grid itself (e.g. the 10,000+ perf run).
  let round = 0;
  generateUsers: while (true) {
    for (const gender of GENDERS) {
      for (const country of COUNTRIES) {
        for (const age of AGES) {
          if (userIds.length >= RESPONSE_COUNT) break generateUsers;
          const userId = randomUUID();
          userIds.push(userId);
          users.push({ id: userId, email: `verify-${round}-${userId}@example.test`, role: "EVALUATOR" });
          profiles.push({ userId, age, gender, country });
        }
      }
    }
    round += 1;
  }

  const userIdsWithoutProfile: string[] = [];
  for (let i = 0; i < 20 && userIds.length < RESPONSE_COUNT + 20; i += 1) {
    const userId = randomUUID();
    userIds.push(userId);
    userIdsWithoutProfile.push(userId);
    users.push({ id: userId, email: `verify-noprofile-${userId}@example.test`, role: "EVALUATOR" });
  }

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    await prisma.user.createMany({ data: users.slice(i, i + BATCH_SIZE) });
  }
  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    await prisma.evaluatorProfile.createMany({ data: profiles.slice(i, i + BATCH_SIZE) });
  }

  // Responses: ~8% flagged (excluded from both old and new aggregation).
  const responses: Prisma.TestResponseCreateManyInput[] = userIds.map((userId, i) => ({
    id: randomUUID(),
    testId,
    userId,
    isFlagged: i % 12 === 0,
    startedAt: new Date(Date.now() - 60_000),
    completedAt: new Date(),
    totalTimeSeconds: 30 + (i % 90),
  }));
  const responseIdByUser = new Map(responses.map((r) => [r.userId, r.id as string]));

  for (let i = 0; i < responses.length; i += BATCH_SIZE) {
    await prisma.testResponse.createMany({ data: responses.slice(i, i + BATCH_SIZE) });
  }

  // Answers for six of the seven questions per response (the unanswered RATING question
  // gets none, on purpose), including the attention-check/trap ones (they must be seeded
  // — and then proven excluded — not just omitted).
  //
  // Each of these deliberately leaves the LAST option/scale-value untouched by any answer,
  // so the zero-count fold-back onto `question.options` (and the rating distribution's
  // zero-fill, and the ranking "never picked" path) is actually exercised — a naive GROUP
  // BY would otherwise silently omit anything nobody picked.
  const coveredSingleSelectOptionIds = singleSelectOptionIds.slice(0, -1);
  const coveredMultiSelectOptionIds = multiSelectOptionIds.slice(0, -1);
  const coveredRankingOptionIds = rankingOptionIds.slice(0, -1);

  const answers: Prisma.AnswerCreateManyInput[] = [];
  userIds.forEach((userId, i) => {
    const responseId = responseIdByUser.get(userId)!;

    answers.push({
      id: randomUUID(),
      responseId,
      questionId: singleSelectQuestionId,
      selectedOptions: [coveredSingleSelectOptionIds[i % coveredSingleSelectOptionIds.length]!],
      timeSpentSeconds: 5,
    });

    const multiCount = 1 + (i % coveredMultiSelectOptionIds.length);
    answers.push({
      id: randomUUID(),
      responseId,
      questionId: multiSelectQuestionId,
      selectedOptions: coveredMultiSelectOptionIds.slice(0, multiCount),
      timeSpentSeconds: 6,
    });

    // ~10% of RATING answers have a null ratingValue on purpose — this is the case
    // where answeredCount (Answer row count) and the rating average's own denominator
    // (non-null ratingValue count) genuinely diverge. Values only ever reach 5 even
    // though the question's config now goes up to 7 (see question creation above).
    const hasRating = i % 10 !== 0;
    answers.push({
      id: randomUUID(),
      responseId,
      questionId: ratingQuestionId,
      selectedOptions: [],
      ratingValue: hasRating ? 1 + (i % 5) : null,
      timeSpentSeconds: 4,
    });

    const rotated = [
      ...coveredRankingOptionIds.slice(i % coveredRankingOptionIds.length),
      ...coveredRankingOptionIds.slice(0, i % coveredRankingOptionIds.length),
    ];
    answers.push({
      id: randomUUID(),
      responseId,
      questionId: rankingQuestionId,
      selectedOptions: rotated,
      timeSpentSeconds: 8,
    });

    answers.push({
      id: randomUUID(),
      responseId,
      questionId: attentionCheckQuestionId,
      selectedOptions: [attentionCheckOptionIds[i % attentionCheckOptionIds.length]!],
      timeSpentSeconds: 2,
    });

    answers.push({
      id: randomUUID(),
      responseId,
      questionId: trapDuplicateQuestionId,
      selectedOptions: [trapDuplicateOptionIds[i % trapDuplicateOptionIds.length]!],
      timeSpentSeconds: 3,
    });
  });

  for (let i = 0; i < answers.length; i += BATCH_SIZE) {
    await prisma.answer.createMany({ data: answers.slice(i, i + BATCH_SIZE) });
  }

  return {
    testId,
    singleSelectQuestionId,
    multiSelectQuestionId,
    ratingQuestionId,
    rankingQuestionId,
    singleSelectOptionIds,
    multiSelectOptionIds,
    rankingOptionIds,
    userIds,
    userIdsWithoutProfile,
  };
}

async function cleanup(seeded: Seeded) {
  await prisma.test.delete({ where: { id: seeded.testId } }).catch(() => {});
  for (let i = 0; i < seeded.userIds.length; i += BATCH_SIZE) {
    await prisma.user.deleteMany({ where: { id: { in: seeded.userIds.slice(i, i + BATCH_SIZE) } } });
  }
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

function diff(path: string, a: unknown, b: unknown): string | null {
  if (a === b) return null;
  if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) return null;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: length ${a.length} !== ${b.length}`;
    for (let i = 0; i < a.length; i += 1) {
      const d = diff(`${path}[${i}]`, a[i], b[i]);
      if (d) return d;
    }
    return null;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const d = diff(`${path}.${key}`, (a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]);
      if (d) return d;
    }
    return null;
  }
  return `${path}: ${inspect(a)} !== ${inspect(b)}`;
}

async function main() {
  console.log(`Seeding ~${RESPONSE_COUNT} responses...`);
  const seedStart = Date.now();
  const seeded = await seed();
  console.log(`Seeded in ${Date.now() - seedStart}ms (test ${seeded.testId})`);

  let failed = false;
  try {
    const newStart = Date.now();
    const newResults = await getTestResults(prisma, seeded.testId);
    const newMs = Date.now() - newStart;

    const legacyStart = Date.now();
    const legacyResults = await legacyGetTestResults(seeded.testId);
    const legacyMs = Date.now() - legacyStart;

    console.log(`getTestResults — new: ${newMs}ms, legacy: ${legacyMs}ms`);
    const resultsDiff = diff("getTestResults", legacyResults, newResults);
    if (resultsDiff) {
      failed = true;
      console.error(`MISMATCH: ${resultsDiff}`);
    } else {
      console.log("getTestResults matches.");
    }

    for (const segmentBy of ["gender", "ageGroup", "country"] as const) {
      const newSegStart = Date.now();
      const newSeg = await getTestResultsByDemographic(prisma, seeded.testId, segmentBy);
      const newSegMs = Date.now() - newSegStart;

      const legacySegStart = Date.now();
      const legacySeg = await legacyGetTestResultsByDemographic(seeded.testId, segmentBy);
      const legacySegMs = Date.now() - legacySegStart;

      console.log(`getTestResultsByDemographic(${segmentBy}) — new: ${newSegMs}ms, legacy: ${legacySegMs}ms`);
      const segDiff = diff(`getTestResultsByDemographic(${segmentBy})`, legacySeg, newSeg);
      if (segDiff) {
        failed = true;
        console.error(`MISMATCH: ${segDiff}`);
      } else {
        console.log(`getTestResultsByDemographic(${segmentBy}) matches.`);
      }
    }
  } finally {
    if (SKIP_CLEANUP) {
      console.log(`SKIP_CLEANUP set — leaving test ${seeded.testId} and its ${seeded.userIds.length} users in place.`);
    } else {
      await cleanup(seeded);
      console.log("Cleaned up seeded data.");
    }
  }

  await prisma.$disconnect();
  if (failed) {
    console.error("\nFAILED — new SQL aggregation disagrees with the legacy in-memory version.");
    process.exit(1);
  }
  console.log("\nOK — new SQL aggregation matches the legacy in-memory version exactly.");
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
