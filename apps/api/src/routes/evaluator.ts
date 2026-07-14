import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@testx/database";
import {
  evaluatorProfileSchema,
  testSubmissionSchema,
} from "@testx/shared";
import { authenticateUser } from "../middleware/authenticate";
import {
  findEligibleTestForEvaluator,
  isEvaluatorEligibleForTest,
} from "../services/test.service";
import { runQualityChecks } from "../services/quality.service";

const evaluatorAuth = { preHandler: [authenticateUser] };

const testTakingInclude = {
  questions: {
    orderBy: { order: "asc" },
    include: {
      options: {
        orderBy: { order: "asc" },
        include: { media: true },
      },
    },
  },
} satisfies Prisma.TestInclude;

type TestForTaking = Prisma.TestGetPayload<{ include: typeof testTakingInclude }>;
type QuestionForTaking = TestForTaking["questions"][number];
type OptionForTaking = QuestionForTaking["options"][number];

function serializeOption(option: OptionForTaking) {
  return {
    id: option.id,
    questionId: option.questionId,
    label: option.label,
    mediaId: option.mediaId,
    order: option.order,
    mediaUrl: option.mediaId ? `/media/${option.mediaId}/file` : null,
    media: option.media
      ? {
          id: option.media.id,
          fileName: option.media.fileName,
          fileType: option.media.fileType,
          mimeType: option.media.mimeType,
          thumbnailUrl: option.media.thumbnailUrl,
          url: `/media/${option.media.id}/file`,
        }
      : null,
  };
}

const SAFE_CONFIG_KEYS = [
  "minSelections",
  "maxSelections",
  "min",
  "max",
  "minLabel",
  "maxLabel",
  "minChars",
  "maxChars",
] as const;

function sanitizeConfig(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== "object") return {};
  const src = config as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of SAFE_CONFIG_KEYS) {
    if (key in src) out[key] = src[key];
  }
  return out;
}

function serializeQuestionForEvaluator(question: QuestionForTaking) {
  return {
    id: question.id,
    testId: question.testId,
    type: question.type,
    prompt: question.prompt,
    mediaType: question.mediaType,
    order: question.order,
    config: sanitizeConfig(question.config),
    options: question.options.map(serializeOption),
  };
}

function serializeTestForEvaluator(test: TestForTaking, extras: { questionCount: number }) {
  return {
    id: test.id,
    title: test.title,
    description: test.description,
    status: test.status,
    responseCap: test.responseCap,
    advisoryTimeMin: test.advisoryTimeMin,
    minTimePerQuestion: test.minTimePerQuestion,
    rewardPoints: test.rewardPoints,
    questionCount: extras.questionCount,
    questions: test.questions.map(serializeQuestionForEvaluator),
  };
}

export const evaluatorRoutes: FastifyPluginAsync = async (app) => {
  app.put("/profile", evaluatorAuth, async (request, reply) => {
    const body = evaluatorProfileSchema.parse(request.body);

    const profile = await app.prisma.evaluatorProfile.upsert({
      where: { userId: request.user!.id },
      update: {
        dateOfBirth: new Date(body.dateOfBirth),
        gender: body.gender,
        country: body.country,
        city: body.city ?? null,
      },
      create: {
        userId: request.user!.id,
        dateOfBirth: new Date(body.dateOfBirth),
        gender: body.gender,
        country: body.country,
        city: body.city ?? null,
      },
    });

    return reply.send(profile);
  });

  app.get("/next-test", evaluatorAuth, async (request, reply) => {
    const test = await findEligibleTestForEvaluator(app.prisma, request.user!.id);
    if (!test) {
      return reply.send({ test: null });
    }
    // Count every question (including attention/trap) so this matches the
    // progress bar the evaluator sees and keeps hidden checks disguised.
    const questionCount = await app.prisma.question.count({
      where: { testId: test.id },
    });
    return reply.send({
      test: {
        id: test.id,
        title: test.title,
        description: test.description,
        advisoryTimeMin: test.advisoryTimeMin,
        rewardPoints: test.rewardPoints,
        questionCount,
      },
    });
  });

  app.get<{ Params: { id: string } }>("/tests/:id", evaluatorAuth, async (request, reply) => {
    const eligibility = await isEvaluatorEligibleForTest(
      app.prisma,
      request.user!.id,
      request.params.id
    );
    if (!eligibility.eligible) {
      return reply
        .status(eligibility.status)
        .send({ error: eligibility.error, message: eligibility.message });
    }

    const test = await app.prisma.test.findUniqueOrThrow({
      where: { id: request.params.id },
      include: testTakingInclude,
    });

    return reply.send(
      serializeTestForEvaluator(test, { questionCount: test.questions.length })
    );
  });

  app.post<{ Params: { id: string } }>(
    "/tests/:id/submit",
    evaluatorAuth,
    async (request, reply) => {
      const body = testSubmissionSchema.parse(request.body);
      const userId = request.user!.id;
      const testId = request.params.id;

      const eligibility = await isEvaluatorEligibleForTest(app.prisma, userId, testId);
      if (!eligibility.eligible) {
        return reply
          .status(eligibility.status)
          .send({ error: eligibility.error, message: eligibility.message });
      }
      const test = eligibility.test;

      const questions = await app.prisma.question.findMany({
        where: { testId },
        orderBy: { order: "asc" },
        include: { options: true },
      });

      const requiredQuestionIds = questions
        .filter((q) => !q.isAttentionCheck && !q.isTrapDuplicate)
        .map((q) => q.id);
      const answersById = new Map(body.answers.map((answer) => [answer.questionId, answer]));

      const missing = requiredQuestionIds.filter((id) => !answersById.has(id));
      if (missing.length > 0) {
        return reply.status(400).send({
          error: "INCOMPLETE_SUBMISSION",
          message: "All required questions must be answered",
          missingQuestionIds: missing,
        });
      }

      const questionsById = new Map(questions.map((q) => [q.id, q]));
      for (const answer of body.answers) {
        const question = questionsById.get(answer.questionId);
        if (!question) {
          return reply.status(400).send({
            error: "INVALID_ANSWER",
            message: "Answer references unknown question",
          });
        }
        if (question.type === "SINGLE_SELECT") {
          if (!answer.selectedOptionIds || answer.selectedOptionIds.length !== 1) {
            return reply.status(400).send({
              error: "INVALID_ANSWER",
              message: "Single select questions require exactly one selection",
            });
          }
        }
        if (question.type === "MULTI_SELECT") {
          const config = (question.config ?? {}) as Record<string, unknown>;
          const min = typeof config.minSelections === "number" ? config.minSelections : 1;
          const max =
            typeof config.maxSelections === "number"
              ? config.maxSelections
              : question.options.length;
          const count = answer.selectedOptionIds?.length ?? 0;
          if (count < min || count > max) {
            return reply.status(400).send({
              error: "INVALID_ANSWER",
              message: `Multi select requires between ${min} and ${max} selections`,
            });
          }
        }
        if (question.type === "RATING") {
          if (typeof answer.ratingValue !== "number") {
            return reply.status(400).send({
              error: "INVALID_ANSWER",
              message: "Rating questions require a numeric value",
            });
          }
          const config = (question.config ?? {}) as Record<string, unknown>;
          const min = typeof config.min === "number" ? config.min : 1;
          const max = typeof config.max === "number" ? config.max : 5;
          if (answer.ratingValue < min || answer.ratingValue > max) {
            return reply.status(400).send({
              error: "INVALID_ANSWER",
              message: `Rating must be between ${min} and ${max}`,
            });
          }
        }
        if (question.type === "FREE_TEXT") {
          const config = (question.config ?? {}) as Record<string, unknown>;
          const minChars = typeof config.minChars === "number" ? config.minChars : 0;
          const maxChars = typeof config.maxChars === "number" ? config.maxChars : 5000;
          const length = (answer.textValue ?? "").length;
          if (length < minChars || length > maxChars) {
            return reply.status(400).send({
              error: "INVALID_ANSWER",
              message: `Free-text answer length must be between ${minChars} and ${maxChars} characters`,
            });
          }
        }
      }

      const { flagReasons, isFlagged } = runQualityChecks({
        questions,
        answers: body.answers,
        minTimePerQuestion: test.minTimePerQuestion,
      });

      const pointsEarned = isFlagged ? 0 : test.rewardPoints;
      const startedAt = new Date(body.startedAt);
      const completedAt = new Date();
      const totalTimeSeconds = body.answers.reduce(
        (sum, answer) => sum + answer.timeSpentSeconds,
        0
      );

      try {
        const response = await app.prisma.$transaction(async (tx) => {
          const created = await tx.testResponse.create({
            data: {
              testId,
              userId,
              isFlagged,
              flagReasons,
              pointsEarned,
              startedAt,
              completedAt,
              totalTimeSeconds,
              answers: {
                create: body.answers.map((answer) => ({
                  questionId: answer.questionId,
                  selectedOptions: answer.selectedOptionIds ?? [],
                  ratingValue: answer.ratingValue ?? null,
                  textValue: answer.textValue ?? null,
                  timeSpentSeconds: answer.timeSpentSeconds,
                })),
              },
            },
          });

          if (pointsEarned > 0) {
            await tx.evaluatorProfile.update({
              where: { userId },
              data: { balance: { increment: pointsEarned } },
            });
          }

          return created;
        });

        return reply.status(201).send({
          id: response.id,
          isFlagged: response.isFlagged,
          flagReasons: response.flagReasons,
          pointsEarned: response.pointsEarned,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return reply.status(409).send({
            error: "ALREADY_SUBMITTED",
            message: "You have already completed this test",
          });
        }
        throw error;
      }
    }
  );

  app.get("/balance", evaluatorAuth, async (request, reply) => {
    const profile = await app.prisma.evaluatorProfile.findUnique({
      where: { userId: request.user!.id },
      select: { balance: true },
    });
    return reply.send({ balance: profile?.balance ?? 0 });
  });
};
