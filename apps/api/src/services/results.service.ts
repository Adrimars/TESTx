import type { Prisma, PrismaClient } from "@testx/database";
import { AGE_GROUPS, ageGroup, calculateAge, type QuestionType } from "@testx/shared";

const scoredQuestionInclude = {
  where: { isAttentionCheck: false, isTrapDuplicate: false },
  orderBy: { order: "asc" },
  include: { options: { orderBy: { order: "asc" } } },
} satisfies Prisma.Test$questionsArgs;

// Overall results never touch evaluator profiles, so they are excluded here to
// avoid loading users/profiles for every response.
const overallInclude = {
  questions: scoredQuestionInclude,
  responses: { include: { answers: true } },
} satisfies Prisma.TestInclude;

const demographicInclude = {
  questions: scoredQuestionInclude,
  responses: {
    include: {
      answers: true,
      user: { include: { evaluatorProfile: true } },
    },
  },
} satisfies Prisma.TestInclude;

type OverallTest = Prisma.TestGetPayload<{ include: typeof overallInclude }>;
type DemographicTest = Prisma.TestGetPayload<{ include: typeof demographicInclude }>;
type ResultQuestion = OverallTest["questions"][number];
type ResultAnswer = Prisma.AnswerGetPayload<Record<string, never>>;
type DemographicResponse = DemographicTest["responses"][number];

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
  mediaType: ResultQuestion["mediaType"];
  answeredCount: number;
  options?: OptionAggregation[];
  rating?: RatingAggregation;
  textResponses?: string[];
};

export type SegmentBy = "gender" | "ageGroup" | "country";

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function aggregateQuestion(question: ResultQuestion, answers: ResultAnswer[]): QuestionResult {
  const base: QuestionResult = {
    questionId: question.id,
    prompt: question.prompt,
    type: question.type,
    mediaType: question.mediaType,
    answeredCount: answers.length,
  };

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

  base.textResponses = answers
    .map((answer) => answer.textValue?.trim())
    .filter((value): value is string => !!value);
  return base;
}

function aggregateQuestions(
  questions: ResultQuestion[],
  responses: Array<{ answers: ResultAnswer[] }>
): QuestionResult[] {
  const answersByQuestion = new Map<string, ResultAnswer[]>();
  for (const response of responses) {
    for (const answer of response.answers) {
      const bucket = answersByQuestion.get(answer.questionId);
      if (bucket) bucket.push(answer);
      else answersByQuestion.set(answer.questionId, [answer]);
    }
  }
  return questions.map((question) =>
    aggregateQuestion(question, answersByQuestion.get(question.id) ?? [])
  );
}

function segmentLabel(response: DemographicResponse, segmentBy: SegmentBy): string | null {
  const profile = response.user.evaluatorProfile;
  if (!profile) return null;
  if (segmentBy === "gender") return profile.gender;
  if (segmentBy === "country") return profile.country;
  return ageGroup(calculateAge(profile.dateOfBirth));
}

function orderedSegmentLabels(segmentBy: SegmentBy, present: Set<string>): string[] {
  if (segmentBy === "ageGroup") {
    return AGE_GROUPS.filter((label) => present.has(label));
  }
  return Array.from(present).sort();
}

export async function getTestResults(prisma: PrismaClient, testId: string) {
  const test = await prisma.test.findUnique({ where: { id: testId }, include: overallInclude });
  if (!test) return null;

  const validResponses = test.responses.filter((response) => !response.isFlagged);
  const flaggedCount = test.responses.length - validResponses.length;
  const completionTimes = validResponses.map((response) => response.totalTimeSeconds);
  const averageCompletionTime =
    completionTimes.length > 0
      ? Math.round(completionTimes.reduce((sum, value) => sum + value, 0) / completionTimes.length)
      : null;

  return {
    testId: test.id,
    title: test.title,
    status: test.status,
    totalResponses: test.responses.length,
    validResponses: validResponses.length,
    flaggedResponses: flaggedCount,
    averageCompletionTime,
    questions: aggregateQuestions(test.questions, validResponses),
  };
}

export async function getTestResultsByDemographic(
  prisma: PrismaClient,
  testId: string,
  segmentBy: SegmentBy
) {
  const test = await prisma.test.findUnique({ where: { id: testId }, include: demographicInclude });
  if (!test) return null;

  const validResponses = test.responses.filter((response) => !response.isFlagged);
  const grouped = new Map<string, DemographicResponse[]>();
  for (const response of validResponses) {
    const label = segmentLabel(response, segmentBy);
    if (!label) continue;
    const bucket = grouped.get(label);
    if (bucket) bucket.push(response);
    else grouped.set(label, [response]);
  }

  const labels = orderedSegmentLabels(segmentBy, new Set(grouped.keys()));

  return {
    testId: test.id,
    title: test.title,
    segmentBy,
    segments: labels.map((label) => {
      const responses = grouped.get(label) ?? [];
      return {
        label,
        responseCount: responses.length,
        questions: aggregateQuestions(test.questions, responses),
      };
    }),
  };
}
