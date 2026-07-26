import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { evaluatorProfileSchema } from "@testx/shared";
import { authenticateUser } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { qualityService } from "../services/quality.service";

const authEval = { preHandler: [authenticateUser, requireRole("EVALUATOR")] };

const submitSchema = z.object({
  startedAt: z.string().datetime(),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        selectedOptionIds: z.array(z.string().uuid()).optional().default([]),
        ratingValue: z.number().int().optional(),
        textValue: z.string().optional(),
        timeSpentSeconds: z.number().int().min(0),
      })
    )
    .min(1),
});

const questionInclude = {
  options: {
    orderBy: { order: "asc" as const },
    include: { media: true },
  },
} as const;

function serializeQuestion(question: {
  id: string;
  testId: string;
  type: string;
  prompt: string;
  mediaType: string | null;
  order: number;
  config: unknown;
  isAttentionCheck: boolean;
  isTrapDuplicate: boolean;
  trapSourceId: string | null;
  options: {
    id: string;
    questionId: string;
    label: string | null;
    mediaId: string | null;
    order: number;
    media: {
      id: string;
      fileName: string;
      fileType: string;
      mimeType: string;
      fileSize: number;
    } | null;
  }[];
}) {
  return {
    id: question.id,
    testId: question.testId,
    type: question.type,
    prompt: question.prompt,
    mediaType: question.mediaType,
    order: question.order,
    config: question.config,
    isAttentionCheck: question.isAttentionCheck,
    isTrapDuplicate: question.isTrapDuplicate,
    trapSourceId: question.trapSourceId,
    options: question.options.map((opt) => ({
      id: opt.id,
      questionId: opt.questionId,
      label: opt.label,
      mediaId: opt.mediaId,
      order: opt.order,
      mediaUrl: opt.mediaId ? `/media/${opt.mediaId}/file` : null,
    })),
  };
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const m = today.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate())) age--;
  return age;
}

function matchesDemographics(
  profile: { dateOfBirth: Date; gender: string; country: string; city: string | null },
  filters: unknown
): boolean {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return true;
  const f = filters as Record<string, unknown>;

  const age = calculateAge(profile.dateOfBirth);
  if (typeof f.ageMin === "number" && age < f.ageMin) return false;
  if (typeof f.ageMax === "number" && age > f.ageMax) return false;

  if (Array.isArray(f.genders) && f.genders.length > 0) {
    if (!f.genders.includes(profile.gender)) return false;
  }
  if (Array.isArray(f.countries) && f.countries.length > 0) {
    if (!f.countries.includes(profile.country)) return false;
  }
  if (Array.isArray(f.cities) && f.cities.length > 0 && profile.city) {
    if (!f.cities.includes(profile.city)) return false;
  }

  return true;
}

export const evaluatorRoutes: FastifyPluginAsync = async (app) => {
  app.put("/profile", { preHandler: [authenticateUser] }, async (request, reply) => {
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

  app.get("/next-test", authEval, async (request, reply) => {
    const profile = await app.prisma.evaluatorProfile.findUnique({
      where: { userId: request.user!.id },
    });
    if (!profile) return reply.status(400).send({ error: "PROFILE_REQUIRED", message: "Complete your profile first" });

    const activeTests = await app.prisma.test.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { responses: true } } },
    });

    const alreadyResponded = await app.prisma.testResponse.findMany({
      where: { userId: request.user!.id },
      select: { testId: true },
    });
    const respondedIds = new Set(alreadyResponded.map((r) => r.testId));

    for (const test of activeTests) {
      if (respondedIds.has(test.id)) continue;
      if (test.responseCap !== null && test._count.responses >= test.responseCap) continue;
      if (!matchesDemographics(profile, test.demographicFilters)) continue;

      return reply.send({
        id: test.id,
        title: test.title,
        description: test.description,
        status: test.status,
        advisoryTimeMin: test.advisoryTimeMin,
        rewardPoints: test.rewardPoints,
        minTimePerQuestion: test.minTimePerQuestion,
        questionCount: (
          await app.prisma.question.count({
            where: { testId: test.id, isAttentionCheck: false, isTrapDuplicate: false },
          })
        ),
      });
    }

    return reply.send(null);
  });

  app.get<{ Params: { id: string } }>("/tests/:id", authEval, async (request, reply) => {
    const profile = await app.prisma.evaluatorProfile.findUnique({
      where: { userId: request.user!.id },
    });
    if (!profile) return reply.status(400).send({ error: "PROFILE_REQUIRED", message: "Complete your profile first" });

    const test = await app.prisma.test.findUnique({
      where: { id: request.params.id },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: questionInclude,
        },
        _count: { select: { responses: true } },
      },
    });

    if (!test) return reply.status(404).send({ error: "NOT_FOUND", message: "Test not found" });
    if (test.status !== "ACTIVE") {
      return reply.status(403).send({ error: "NOT_AVAILABLE", message: "This test is not available" });
    }
    if (test.responseCap !== null && test._count.responses >= test.responseCap) {
      return reply.status(403).send({ error: "CAPACITY_REACHED", message: "This test has reached its response cap" });
    }
    if (!matchesDemographics(profile, test.demographicFilters)) {
      return reply.status(403).send({ error: "NOT_ELIGIBLE", message: "You are not eligible for this test" });
    }

    return reply.send({
      id: test.id,
      title: test.title,
      description: test.description,
      status: test.status,
      advisoryTimeMin: test.advisoryTimeMin,
      minTimePerQuestion: test.minTimePerQuestion,
      rewardPoints: test.rewardPoints,
      questions: test.questions.map(serializeQuestion),
    });
  });

  app.post<{ Params: { id: string } }>("/tests/:id/submit", authEval, async (request, reply) => {
    const userId = request.user!.id;

    const existing = await app.prisma.testResponse.findUnique({
      where: { testId_userId: { testId: request.params.id, userId } },
    });
    if (existing) {
      return reply.status(409).send({ error: "ALREADY_SUBMITTED", message: "You have already submitted this test" });
    }

    const test = await app.prisma.test.findUnique({
      where: { id: request.params.id },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
        _count: { select: { responses: true } },
      },
    });

    if (!test) return reply.status(404).send({ error: "NOT_FOUND", message: "Test not found" });
    if (test.status === "PAUSED") {
      return reply.status(403).send({ error: "TEST_PAUSED", message: "This test has been paused" });
    }
    if (test.status === "CLOSED") {
      return reply.status(403).send({ error: "TEST_CLOSED", message: "This test is no longer accepting responses" });
    }
    if (test.status !== "ACTIVE") {
      return reply.status(403).send({ error: "NOT_AVAILABLE", message: "This test is not available" });
    }
    if (test.responseCap !== null && test._count.responses >= test.responseCap) {
      return reply.status(403).send({ error: "CAPACITY_REACHED", message: "This test has reached its response cap" });
    }

    const body = submitSchema.parse(request.body);
    const { answers } = body;

    // Validate all required questions are answered
    const requiredQuestions = test.questions.filter((q) => !q.isAttentionCheck && !q.isTrapDuplicate);
    const answeredIds = new Set(answers.map((a) => a.questionId));
    const missing = requiredQuestions.filter((q) => !answeredIds.has(q.id));
    if (missing.length > 0) {
      return reply.status(400).send({
        error: "INCOMPLETE",
        message: `Missing answers for questions: ${missing.map((q) => q.id).join(", ")}`,
      });
    }

    const { isFlagged, flagReasons } = qualityService.runChecks(
      answers,
      test.questions.map((q) => ({
        id: q.id,
        type: q.type,
        isAttentionCheck: q.isAttentionCheck,
        isTrapDuplicate: q.isTrapDuplicate,
        trapSourceId: q.trapSourceId,
        config: q.config,
        options: q.options.map((o) => ({ id: o.id, order: o.order, label: o.label })),
      })),
      test.minTimePerQuestion
    );

    const startedAt = new Date(body.startedAt);
    const completedAt = new Date();
    const totalTimeSeconds = Math.round((completedAt.getTime() - startedAt.getTime()) / 1000);
    const pointsEarned = isFlagged ? 0 : test.rewardPoints;

    await app.prisma.$transaction(async (tx) => {
      const response = await tx.testResponse.create({
        data: {
          testId: test.id,
          userId,
          isFlagged,
          flagReasons,
          pointsEarned,
          startedAt,
          completedAt,
          totalTimeSeconds,
          answers: {
            create: answers.map((a) => ({
              questionId: a.questionId,
              selectedOptions: a.selectedOptionIds ?? [],
              ratingValue: a.ratingValue ?? null,
              textValue: a.textValue ?? null,
              timeSpentSeconds: a.timeSpentSeconds,
            })),
          },
        },
      });

      if (!isFlagged && pointsEarned > 0) {
        await tx.evaluatorProfile.update({
          where: { userId },
          data: { balance: { increment: pointsEarned } },
        });
      }

      return response;
    });

    return reply.send({ pointsEarned, isFlagged, flagReasons });
  });

  app.get("/balance", authEval, async (request, reply) => {
    const profile = await app.prisma.evaluatorProfile.findUnique({
      where: { userId: request.user!.id },
      select: { balance: true },
    });
    if (!profile) return reply.status(400).send({ error: "PROFILE_REQUIRED", message: "Complete your profile first" });
    return reply.send({ balance: profile.balance });
  });
};
