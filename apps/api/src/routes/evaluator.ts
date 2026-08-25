import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  DEFAULT_RATING_MAX,
  DEFAULT_RATING_MIN,
  evaluatorProfileSchema,
} from "@testx/shared";
import { authenticateUser } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { qualityService } from "../services/quality.service";
import {
  ResponseCapReachedError,
  assertResponseCapAvailable,
} from "../services/submission.service";
import { signTestSessionToken, verifyTestSessionToken } from "../lib/jwt";

const authEval = { preHandler: [authenticateUser, requireRole("EVALUATOR")] };

const submitSchema = z.object({
  sessionToken: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        selectedOptionIds: z.array(z.string().uuid()).optional().default([]),
        ratingValue: z.number().int().optional(),
        timeSpentSeconds: z.number().int().min(0),
      })
    )
    .min(1),
});

const questionInclude = {
  media: true,
  options: {
    orderBy: { order: "asc" as const },
    include: { media: true },
  },
} as const;

/**
 * Question config is admin-authored and holds the grading key for attention checks
 * (`correctOptionLabel` / `correctOptionOrder`). Only the keys the renderer actually
 * needs are forwarded — anything not listed here stays server-side.
 */
const PUBLIC_CONFIG_KEYS: Record<string, readonly string[]> = {
  SINGLE_SELECT: [],
  MULTI_SELECT: ["minSelections", "maxSelections"],
  RATING: ["min", "max", "minLabel", "maxLabel"],
  ORDERING: ["topLabel", "bottomLabel"],
};

function toConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function publicConfig(type: string, raw: unknown): Record<string, unknown> {
  const config = toConfig(raw);
  const result: Record<string, unknown> = {};
  for (const key of PUBLIC_CONFIG_KEYS[type] ?? []) {
    if (config[key] !== undefined) result[key] = config[key];
  }
  return result;
}

type SubmittedAnswer = z.infer<typeof submitSchema>["answers"][number];

type ValidatedAnswer = {
  questionId: string;
  selectedOptionIds: string[];
  ratingValue?: number;
  timeSpentSeconds: number;
};

type QuestionForValidation = {
  id: string;
  type: string;
  config: unknown;
  options: { id: string }[];
};

/**
 * Rejects what an honest client cannot produce — an answer to a question outside this test,
 * two answers to the same question, an option belonging to a different question, more
 * selections than the type allows, or an out-of-range rating.
 *
 * Under-filled answers (nothing selected, no rating) are deliberately *not* rejected:
 * they are reachable by an honest evaluator and are the quality service's call to make.
 */
function validateAnswers(
  submitted: SubmittedAnswer[],
  questions: QuestionForValidation[]
): { answers: ValidatedAnswer[] } | { message: string } {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const seen = new Set<string>();
  const answers: ValidatedAnswer[] = [];

  for (const submittedAnswer of submitted) {
    const { questionId, timeSpentSeconds } = submittedAnswer;
    const question = byId.get(questionId);
    if (!question) {
      return { message: `Question ${questionId} does not belong to this test` };
    }
    if (seen.has(questionId)) {
      return { message: `Question ${questionId} was answered more than once` };
    }
    seen.add(questionId);

    const config = toConfig(question.config);
    const selected = submittedAnswer.selectedOptionIds ?? [];
    const optionIds = new Set(question.options.map((o) => o.id));
    for (const optionId of selected) {
      if (!optionIds.has(optionId)) {
        return { message: `Option ${optionId} does not belong to question ${questionId}` };
      }
    }
    if (new Set(selected).size !== selected.length) {
      return { message: `Question ${questionId} has the same option selected twice` };
    }

    const base = { questionId, timeSpentSeconds };

    if (question.type === "SINGLE_SELECT") {
      if (selected.length > 1) {
        return { message: `Question ${questionId} accepts a single option` };
      }
      answers.push({ ...base, selectedOptionIds: selected });
      continue;
    }

    if (question.type === "MULTI_SELECT") {
      const maxSelections = numberOr(config.maxSelections, question.options.length);
      if (selected.length > maxSelections) {
        return { message: `Question ${questionId} accepts at most ${maxSelections} options` };
      }
      answers.push({ ...base, selectedOptionIds: selected });
      continue;
    }

    if (question.type === "ORDERING") {
      // The ranking *is* the answer, so a partial one is not an under-filled answer the
      // quality service could judge — it is a payload an honest client cannot produce.
      if (selected.length !== question.options.length) {
        return { message: `Question ${questionId} must rank every option exactly once` };
      }
      answers.push({ ...base, selectedOptionIds: selected });
      continue;
    }

    if (question.type === "RATING") {
      const min = numberOr(config.min, DEFAULT_RATING_MIN);
      const max = numberOr(config.max, DEFAULT_RATING_MAX);
      const { ratingValue } = submittedAnswer;
      if (ratingValue !== undefined && (ratingValue < min || ratingValue > max)) {
        return { message: `Rating for question ${questionId} must be between ${min} and ${max}` };
      }
      answers.push({ ...base, selectedOptionIds: [], ratingValue });
      continue;
    }

    // Unrecognised question type — skip gracefully
    answers.push({ ...base, selectedOptionIds: [] });
  }

  return { answers };
}

type SerializableMedia = {
  id: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  thumbnailUrl: string | null;
};

function serializePublicMedia(media: SerializableMedia) {
  return {
    id: media.id,
    fileName: media.fileName,
    fileType: media.fileType,
    mimeType: media.mimeType,
    thumbnailUrl: media.thumbnailUrl,
    url: `/media/${media.id}/file`,
  };
}

function serializeQuestion(question: {
  id: string;
  testId: string;
  type: string;
  prompt: string;
  mediaType: string | null;
  mediaId: string | null;
  media: SerializableMedia | null;
  order: number;
  config: unknown;
  isAttentionCheck: boolean;
  isTrapDuplicate: boolean;
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
      thumbnailUrl: string | null;
    } | null;
  }[];
}) {
  return {
    id: question.id,
    testId: question.testId,
    type: question.type,
    prompt: question.prompt,
    mediaType: question.mediaType,
    // The media the question is about — the image being rated, the clip being ranked.
    mediaId: question.mediaId,
    media: question.media ? serializePublicMedia(question.media) : null,
    mediaUrl: question.mediaId ? `/media/${question.mediaId}/file` : null,
    order: question.order,
    config: publicConfig(question.type, question.config),
    isReviewHidden: question.isAttentionCheck || question.isTrapDuplicate,
    options: question.options.map((opt) => ({
      id: opt.id,
      questionId: opt.questionId,
      label: opt.label,
      mediaId: opt.mediaId,
      order: opt.order,
      mediaUrl: opt.mediaId ? `/media/${opt.mediaId}/file` : null,
      media: opt.media ? serializePublicMedia(opt.media) : null,
    })),
  };
}

function matchesDemographics(
  profile: { age: number; gender: string; country: string; city: string | null },
  filters: unknown
): boolean {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return true;
  const f = filters as Record<string, unknown>;

  if (typeof f.ageMin === "number" && profile.age < f.ageMin) return false;
  if (typeof f.ageMax === "number" && profile.age > f.ageMax) return false;

  if (Array.isArray(f.genders) && f.genders.length > 0) {
    if (!f.genders.includes(profile.gender)) return false;
  }
  if (Array.isArray(f.countries) && f.countries.length > 0) {
    if (!f.countries.includes(profile.country)) return false;
  }
  if (Array.isArray(f.cities) && f.cities.length > 0) {
    if (!profile.city || !f.cities.includes(profile.city)) return false;
  }

  return true;
}

export const evaluatorRoutes: FastifyPluginAsync = async (app) => {
  app.put("/profile", { preHandler: [authenticateUser] }, async (request, reply) => {
    const body = evaluatorProfileSchema.parse(request.body);

    const profileData = {
      age: body.age,
      gender: body.gender,
      country: body.country,
      city: body.city ?? null,
      nativeLanguage: body.nativeLanguage ?? null,
      foreignLanguages: body.foreignLanguages ?? [],
      occupation: body.occupation ?? null,
      educationLevel: body.educationLevel ?? null,
      aiUseCases: body.aiUseCases ?? [],
      aiExperience: body.aiExperience ?? null,
      aiFrequency: body.aiFrequency ?? null,
    };
    const profile = await app.prisma.evaluatorProfile.upsert({
      where: { userId: request.user!.id },
      update: profileData,
      create: { userId: request.user!.id, ...profileData },
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
        questionCount: await app.prisma.question.count({ where: { testId: test.id } }),
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
      questionCount: test.questions.length,
      questions: test.questions.map(serializeQuestion),
      sessionToken: signTestSessionToken({
        testId: test.id,
        userId: request.user!.id,
        startedAt: new Date().toISOString(),
      }),
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

    let session;
    try {
      session = verifyTestSessionToken(body.sessionToken);
    } catch {
      return reply.status(400).send({
        error: "INVALID_SESSION",
        message: "Your test session is invalid or has expired. Please start the test again.",
      });
    }
    if (session.testId !== test.id || session.userId !== userId) {
      return reply.status(403).send({
        error: "INVALID_SESSION",
        message: "This session token does not belong to this test",
      });
    }

    const validation = validateAnswers(body.answers, test.questions);
    if ("message" in validation) {
      return reply.status(400).send({ error: "INVALID_ANSWER", message: validation.message });
    }
    const { answers } = validation;

    const answeredIds = new Set(answers.map((a) => a.questionId));
    const missing = test.questions.filter((q) => !answeredIds.has(q.id));
    if (missing.length > 0) {
      return reply.status(400).send({
        error: "INCOMPLETE",
        message: `Missing answers for questions: ${missing.map((q) => q.id).join(", ")}`,
      });
    }

    const startedAt = new Date(session.startedAt);
    const completedAt = new Date();
    const totalTimeSeconds = Math.max(
      0,
      Math.round((completedAt.getTime() - startedAt.getTime()) / 1000)
    );

    const reportedTotal = answers.reduce((sum, a) => sum + a.timeSpentSeconds, 0);
    const scale = reportedTotal > totalTimeSeconds ? totalTimeSeconds / reportedTotal : 1;
    const timedAnswers = answers.map((a) => ({
      ...a,
      timeSpentSeconds: Math.floor(a.timeSpentSeconds * scale),
    }));

    const { isFlagged, flagReasons, warnings } = qualityService.runChecks({
      answers: timedAnswers,
      questions: test.questions.map((q) => ({
        id: q.id,
        type: q.type,
        isAttentionCheck: q.isAttentionCheck,
        isTrapDuplicate: q.isTrapDuplicate,
        trapSourceId: q.trapSourceId,
        config: q.config,
        options: q.options.map((o) => ({
          id: o.id,
          order: o.order,
          label: o.label,
          mediaId: o.mediaId,
        })),
      })),
      minTimePerQuestion: test.minTimePerQuestion,
      sessionSeconds: totalTimeSeconds,
    });

    for (const warning of warnings) {
      app.log.warn({ testId: test.id }, warning);
    }

    const pointsEarned = isFlagged ? 0 : test.rewardPoints;

    try {
      await app.prisma.$transaction(async (tx) => {
        await assertResponseCapAvailable(tx, test.id, test.responseCap);

        await tx.testResponse.create({
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
              create: timedAnswers.map((a) => ({
                questionId: a.questionId,
                selectedOptions: a.selectedOptionIds,
                ratingValue: a.ratingValue ?? null,
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
      });
    } catch (error) {
      if (error instanceof ResponseCapReachedError) {
        return reply
          .status(403)
          .send({ error: "CAPACITY_REACHED", message: "This test has reached its response cap" });
      }
      throw error;
    }

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
