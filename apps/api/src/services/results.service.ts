import type { Prisma, PrismaClient } from "@testx/database";
import type { QuestionType } from "@testx/shared";

const resultsInclude = {
  questions: {
    where: { isAttentionCheck: false, isTrapDuplicate: false },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } } },
  },
  responses: {
    include: {
      answers: true,
      user: { include: { evaluatorProfile: true } },
    },
  },
} satisfies Prisma.TestInclude;

type TestWithResults = Prisma.TestGetPayload<{ include: typeof resultsInclude }>;
type ResultQuestion = TestWithResults["questions"][number];
type ResultResponse = TestWithResults["responses"][number];
type ResultAnswer = ResultResponse["answers"][number];

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

const AGE_GROUPS = ["18-24", "25-34", "35-44", "45-54", "55+"] as const;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function calculateAge(dob: Date, reference: Date = new Date()): number {
  let age = reference.getFullYear() - dob.getFullYear();
  const monthDiff = reference.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

function ageGroup(age: number): string {
  if (age <= 24) return "18-24";
  if (age <= 34) return "25-34";
  if (age <= 44) return "35-44";
  if (age <= 54) return "45-54";
  return "55+";
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
    const totalSelections = answers.reduce((sum, answer) => sum + answer.selectedOptions.length, 0);
    base.options = question.options.map((option) => {
      const count = answers.filter((answer) => answer.selectedOptions.includes(option.id)).length;
      const denominator = question.type === "MULTI_SELECT" ? totalSelections : answers.length;
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
    const scaleMin = typeof config.minValue === "number" ? config.minValue : 1;
    const scaleMax = typeof config.maxValue === "number" ? config.maxValue : 5;
    const values = answers
      .map((answer) => answer.ratingValue)
      .filter((value): value is number => typeof value === "number");

    const distribution: Array<{ value: number; count: number }> = [];
    for (let value = scaleMin; value <= scaleMax; value += 1) {
      distribution.push({ value, count: values.filter((item) => item === value).length });
    }

    base.rating = {
      average: values.length > 0 ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
      min: values.length > 0 ? Math.min(...values) : null,
      max: values.length > 0 ? Math.max(...values) : null,
      distribution,
    };
    return base;
  }

  base.textResponses = answers
    .map((answer) => answer.textValue?.trim())
    .filter((value): value is string => !!value);
  return base;
}

function aggregateQuestions(questions: ResultQuestion[], responses: ResultResponse[]): QuestionResult[] {
  const answers = responses.flatMap((response) => response.answers);
  const answersByQuestion = new Map<string, ResultAnswer[]>();
  for (const answer of answers) {
    const bucket = answersByQuestion.get(answer.questionId);
    if (bucket) bucket.push(answer);
    else answersByQuestion.set(answer.questionId, [answer]);
  }
  return questions.map((question) => aggregateQuestion(question, answersByQuestion.get(question.id) ?? []));
}

function segmentLabel(response: ResultResponse, segmentBy: SegmentBy): string | null {
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
  const test = await prisma.test.findUnique({ where: { id: testId }, include: resultsInclude });
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
  const test = await prisma.test.findUnique({ where: { id: testId }, include: resultsInclude });
  if (!test) return null;

  const validResponses = test.responses.filter((response) => !response.isFlagged);
  const grouped = new Map<string, ResultResponse[]>();
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
