import type { FastifyPluginAsync } from "fastify";
import type { MediaType, QuestionInput, QuestionType, TestStatus } from "@testx/shared";
import {
  calculateTestReward,
  createTestSchema,
  questionSchema,
  reorderQuestionsSchema,
  updateTestSchema,
  updateTestStatusSchema,
} from "@testx/shared";
import { Prisma } from "@testx/database";
import { authenticateUser } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";

const adminAuth = { preHandler: [authenticateUser, requireRole("ADMIN")] };

const validTransitions: Record<TestStatus, TestStatus[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["PAUSED", "CLOSED"],
  PAUSED: ["ACTIVE", "CLOSED"],
  CLOSED: [],
};

const testDetailInclude = {
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

const testListInclude = {
  _count: { select: { questions: true, responses: true } },
} satisfies Prisma.TestInclude;

type TestDetail = Prisma.TestGetPayload<{ include: typeof testDetailInclude }>;
type TestListItem = Prisma.TestGetPayload<{ include: typeof testListInclude }>;
type QuestionDetail = TestDetail["questions"][number];

function serializeMedia(media: NonNullable<QuestionDetail["options"][number]["media"]>) {
  return {
    id: media.id,
    fileName: media.fileName,
    fileType: media.fileType,
    mimeType: media.mimeType,
    fileSize: media.fileSize,
    sourceType: media.sourceType,
    sourceUrl: media.sourceUrl,
    thumbnailUrl: media.thumbnailUrl,
    tags: media.tags,
    uploadedAt: media.uploadedAt.toISOString(),
    url: `/media/${media.id}/file`,
  };
}

function serializeQuestion(question: QuestionDetail) {
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
    createdAt: question.createdAt.toISOString(),
    options: question.options.map((option) => ({
      id: option.id,
      questionId: option.questionId,
      label: option.label,
      mediaId: option.mediaId,
      order: option.order,
      media: option.media ? serializeMedia(option.media) : null,
      mediaUrl: option.mediaId ? `/media/${option.mediaId}/file` : null,
    })),
  };
}

function serializeTest(test: TestDetail) {
  return {
    id: test.id,
    title: test.title,
    description: test.description,
    status: test.status,
    responseCap: test.responseCap,
    advisoryTimeMin: test.advisoryTimeMin,
    minTimePerQuestion: test.minTimePerQuestion,
    demographicFilters: test.demographicFilters,
    rewardPoints: test.rewardPoints,
    createdAt: test.createdAt.toISOString(),
    updatedAt: test.updatedAt.toISOString(),
    questions: test.questions.map(serializeQuestion),
  };
}

function serializeTestListItem(test: TestListItem) {
  return {
    id: test.id,
    title: test.title,
    description: test.description,
    status: test.status,
    responseCap: test.responseCap,
    advisoryTimeMin: test.advisoryTimeMin,
    minTimePerQuestion: test.minTimePerQuestion,
    demographicFilters: test.demographicFilters,
    rewardPoints: test.rewardPoints,
    createdAt: test.createdAt.toISOString(),
    updatedAt: test.updatedAt.toISOString(),
    questionCount: test._count.questions,
    responseCount: test._count.responses,
  };
}

function assertDraft(test: { status: TestStatus }) {
  if (test.status !== "DRAFT") {
    throw Object.assign(new Error("Only draft tests can be edited"), { statusCode: 400 });
  }
}

function validateQuestionShape(input: QuestionInput) {
  if (input.type === "SINGLE_SELECT" || input.type === "MULTI_SELECT") {
    if (input.options.length < 2 || input.options.length > 10) {
      throw Object.assign(new Error("Selection questions require 2 to 10 options"), { statusCode: 400 });
    }
    for (const option of input.options) {
      if (!option.label && !option.mediaId) {
        throw Object.assign(new Error("Each selection option needs a label or media item"), { statusCode: 400 });
      }
    }
    return;
  }

  if (input.options.length > 0) {
    throw Object.assign(new Error("Rating and free-text questions cannot have options"), { statusCode: 400 });
  }
}

async function validateMediaOptions(app: Parameters<FastifyPluginAsync>[0], input: QuestionInput) {
  const mediaIds = [...new Set(input.options.map((option) => option.mediaId).filter(Boolean))] as string[];
  if (mediaIds.length === 0) return;

  const media = await app.prisma.media.findMany({ where: { id: { in: mediaIds } } });
  if (media.length !== mediaIds.length) {
    throw Object.assign(new Error("One or more media options were not found"), { statusCode: 400 });
  }

  if (input.mediaType && input.mediaType !== "TEXT") {
    const mismatch = media.find((item) => item.fileType !== input.mediaType);
    if (mismatch) {
      throw Object.assign(new Error(`Media option ${mismatch.fileName} does not match ${input.mediaType}`), {
        statusCode: 400,
      });
    }
  }
}

async function validateTrapSource(
  app: Parameters<FastifyPluginAsync>[0],
  testId: string,
  input: QuestionInput,
  questionId?: string
) {
  if (!input.isTrapDuplicate) return;
  if (!input.trapSourceId) {
    throw Object.assign(new Error("Trap duplicate questions require trapSourceId"), { statusCode: 400 });
  }
  if (input.trapSourceId === questionId) {
    throw Object.assign(new Error("A trap duplicate cannot reference itself"), { statusCode: 400 });
  }
  const source = await app.prisma.question.findFirst({ where: { id: input.trapSourceId, testId } });
  if (!source) {
    throw Object.assign(new Error("Trap source question was not found in this test"), { statusCode: 400 });
  }
}

async function recalculateReward(app: Parameters<FastifyPluginAsync>[0], testId: string) {
  const questions = await app.prisma.question.findMany({
    where: { testId },
    select: { type: true, isAttentionCheck: true, isTrapDuplicate: true },
  });
  const rewardPoints = calculateTestReward(questions);
  await app.prisma.test.update({ where: { id: testId }, data: { rewardPoints } });
  return rewardPoints;
}

function buildOptionCreates(input: QuestionInput) {
  return input.options.map((option, index) => ({
    label: option.label ?? null,
    mediaId: option.mediaId ?? null,
    order: option.order || index + 1,
  }));
}

async function ensureAttentionCheck(app: Parameters<FastifyPluginAsync>[0], testId: string) {
  const questions = await app.prisma.question.findMany({
    where: { testId },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } } },
  });
  if (questions.some((question) => question.isAttentionCheck)) return;

  const source = questions.find((question) => question.options.length >= 2);
  const nextOrder = questions.length + 1;

  if (source) {
    const correctOption = source.options[0];
    await app.prisma.question.create({
      data: {
        testId,
        type: "SINGLE_SELECT",
        prompt: `Attention check: select "${correctOption?.label ?? "the first option"}".`,
        mediaType: source.mediaType,
        order: nextOrder,
        isAttentionCheck: true,
        config: {
          autoGenerated: true,
          correctOptionOrder: correctOption?.order ?? 1,
          correctOptionLabel: correctOption?.label ?? null,
        },
        options: {
          create: source.options.map((option) => ({
            label: option.label,
            mediaId: option.mediaId,
            order: option.order,
          })),
        },
      },
    });
    return;
  }

  await app.prisma.question.create({
    data: {
      testId,
      type: "SINGLE_SELECT",
      prompt: "Attention check: select the option that says I am paying attention.",
      mediaType: "TEXT",
      order: nextOrder,
      isAttentionCheck: true,
      config: { autoGenerated: true, correctOptionLabel: "I am paying attention" },
      options: {
        create: [
          { label: "I am paying attention", order: 1 },
          { label: "Skip this option", order: 2 },
        ],
      },
    },
  });
}

type TemplateQuestion = {
  type?: QuestionType;
  prompt?: string;
  mediaType?: MediaType;
  config?: Record<string, unknown>;
  options?: Array<string | { label?: string; mediaId?: string }>;
};

function templateQuestions(structure: Prisma.JsonValue): TemplateQuestion[] {
  if (!structure || typeof structure !== "object" || Array.isArray(structure)) return [];
  const questions = (structure as { questions?: unknown }).questions;
  return Array.isArray(questions) ? (questions as TemplateQuestion[]) : [];
}

function inputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export const adminTestsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/tests", adminAuth, async (request) => {
    const { page, limit, status } = request.query as { page?: string; limit?: string; status?: TestStatus };
    const currentPage = Math.max(1, page ? Number(page) : 1);
    const pageSize = Math.min(100, Math.max(1, limit ? Number(limit) : 50));
    const where: Prisma.TestWhereInput = {};
    if (status && ["DRAFT", "ACTIVE", "PAUSED", "CLOSED"].includes(status)) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      app.prisma.test.findMany({
        where,
        include: testListInclude,
        orderBy: { createdAt: "desc" },
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      }),
      app.prisma.test.count({ where }),
    ]);

    return { items: items.map(serializeTestListItem), total, page: currentPage, limit: pageSize };
  });

  app.post("/tests", adminAuth, async (request, reply) => {
    const body = createTestSchema.parse(request.body);
    const test = await app.prisma.test.create({ data: body, include: testDetailInclude });
    return reply.status(201).send(serializeTest(test));
  });

  app.get<{ Params: { id: string } }>("/tests/:id", adminAuth, async (request, reply) => {
    const test = await app.prisma.test.findUnique({ where: { id: request.params.id }, include: testDetailInclude });
    if (!test) return reply.status(404).send({ error: "NOT_FOUND", message: "Test not found" });
    return serializeTest(test);
  });

  app.put<{ Params: { id: string } }>("/tests/:id", adminAuth, async (request, reply) => {
    const existing = await app.prisma.test.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND", message: "Test not found" });
    assertDraft(existing);

    const body = updateTestSchema.parse(request.body);
    const data: Prisma.TestUpdateInput = {};
    if (body.title !== undefined) data.title = body.title;
    if ("description" in body) data.description = body.description;
    if ("responseCap" in body) data.responseCap = body.responseCap;
    if ("advisoryTimeMin" in body) data.advisoryTimeMin = body.advisoryTimeMin;
    if (body.minTimePerQuestion !== undefined) data.minTimePerQuestion = body.minTimePerQuestion;
    if ("demographicFilters" in body) {
      data.demographicFilters =
        body.demographicFilters === null ? Prisma.JsonNull : (body.demographicFilters as Prisma.InputJsonValue);
    }
    const test = await app.prisma.test.update({
      where: { id: request.params.id },
      data,
      include: testDetailInclude,
    });
    return serializeTest(test);
  });

  app.delete<{ Params: { id: string } }>("/tests/:id", adminAuth, async (request, reply) => {
    const existing = await app.prisma.test.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND", message: "Test not found" });
    assertDraft(existing);
    await app.prisma.test.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });

  app.put<{ Params: { id: string } }>("/tests/:id/status", adminAuth, async (request, reply) => {
    const { status } = updateTestStatusSchema.parse(request.body);
    const existing = await app.prisma.test.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND", message: "Test not found" });
    if (!validTransitions[existing.status].includes(status)) {
      return reply.status(400).send({
        error: "INVALID_TRANSITION",
        message: `Cannot change status from ${existing.status} to ${status}`,
      });
    }

    if (status === "ACTIVE") {
      await ensureAttentionCheck(app, existing.id);
    }
    const rewardPoints = await recalculateReward(app, existing.id);
    const test = await app.prisma.test.update({
      where: { id: existing.id },
      data: { status, rewardPoints },
      include: testDetailInclude,
    });
    return serializeTest(test);
  });

  app.get<{ Params: { id: string } }>("/tests/:id/preview", adminAuth, async (request, reply) => {
    const test = await app.prisma.test.findUnique({ where: { id: request.params.id }, include: testDetailInclude });
    if (!test) return reply.status(404).send({ error: "NOT_FOUND", message: "Test not found" });
    return serializeTest(test);
  });

  app.post<{ Params: { id: string } }>("/tests/:id/questions", adminAuth, async (request, reply) => {
    const test = await app.prisma.test.findUnique({ where: { id: request.params.id } });
    if (!test) return reply.status(404).send({ error: "NOT_FOUND", message: "Test not found" });
    assertDraft(test);

    const body = questionSchema.parse(request.body);
    validateQuestionShape(body);
    await validateMediaOptions(app, body);
    await validateTrapSource(app, test.id, body);

    const last = await app.prisma.question.findFirst({
      where: { testId: test.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    await app.prisma.question.create({
      data: {
        testId: test.id,
        type: body.type,
        prompt: body.prompt,
        mediaType: body.mediaType ?? null,
        order: (last?.order ?? 0) + 1,
        config: inputJson(body.config),
        isAttentionCheck: body.isAttentionCheck,
        isTrapDuplicate: body.isTrapDuplicate,
        trapSourceId: body.trapSourceId ?? null,
        options: { create: buildOptionCreates(body) },
      },
    });
    await recalculateReward(app, test.id);

    const updated = await app.prisma.test.findUniqueOrThrow({ where: { id: test.id }, include: testDetailInclude });
    return reply.status(201).send(serializeTest(updated));
  });

  app.put<{ Params: { id: string } }>("/questions/:id", adminAuth, async (request, reply) => {
    const existing = await app.prisma.question.findUnique({
      where: { id: request.params.id },
      include: { test: true },
    });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND", message: "Question not found" });
    assertDraft(existing.test);

    const body = questionSchema.parse(request.body);
    validateQuestionShape(body);
    await validateMediaOptions(app, body);
    await validateTrapSource(app, existing.testId, body, existing.id);

    await app.prisma.$transaction([
      app.prisma.questionOption.deleteMany({ where: { questionId: existing.id } }),
      app.prisma.question.update({
        where: { id: existing.id },
        data: {
          type: body.type,
          prompt: body.prompt,
          mediaType: body.mediaType ?? null,
          config: inputJson(body.config),
          isAttentionCheck: body.isAttentionCheck,
          isTrapDuplicate: body.isTrapDuplicate,
          trapSourceId: body.trapSourceId ?? null,
          options: { create: buildOptionCreates(body) },
        },
      }),
    ]);
    await recalculateReward(app, existing.testId);

    const updated = await app.prisma.test.findUniqueOrThrow({ where: { id: existing.testId }, include: testDetailInclude });
    return serializeTest(updated);
  });

  app.delete<{ Params: { id: string } }>("/questions/:id", adminAuth, async (request, reply) => {
    const existing = await app.prisma.question.findUnique({
      where: { id: request.params.id },
      include: { test: true },
    });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND", message: "Question not found" });
    assertDraft(existing.test);

    const laterQuestions = await app.prisma.question.findMany({
      where: { testId: existing.testId, order: { gt: existing.order } },
      orderBy: { order: "asc" },
      select: { id: true, order: true },
    });

    await app.prisma.$transaction([
      app.prisma.question.updateMany({
        where: { trapSourceId: existing.id },
        data: { trapSourceId: null, isTrapDuplicate: false },
      }),
      app.prisma.question.delete({ where: { id: existing.id } }),
      ...laterQuestions.map((question, index) =>
        app.prisma.question.update({ where: { id: question.id }, data: { order: -1 * (index + 1) } })
      ),
      ...laterQuestions.map((question) =>
        app.prisma.question.update({ where: { id: question.id }, data: { order: question.order - 1 } })
      ),
    ]);
    await recalculateReward(app, existing.testId);

    const updated = await app.prisma.test.findUniqueOrThrow({ where: { id: existing.testId }, include: testDetailInclude });
    return serializeTest(updated);
  });

  app.put<{ Params: { id: string } }>("/tests/:id/questions/reorder", adminAuth, async (request, reply) => {
    const test = await app.prisma.test.findUnique({
      where: { id: request.params.id },
      include: { questions: { select: { id: true } } },
    });
    if (!test) return reply.status(404).send({ error: "NOT_FOUND", message: "Test not found" });
    assertDraft(test);

    const { questionIds } = reorderQuestionsSchema.parse(request.body);
    const existingIds = test.questions.map((question) => question.id).sort();
    const requestedIds = [...questionIds].sort();
    if (existingIds.length !== requestedIds.length || existingIds.some((id, index) => id !== requestedIds[index])) {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "Reorder payload must contain every question once" });
    }

    await app.prisma.$transaction([
      ...questionIds.map((id, index) =>
        app.prisma.question.update({ where: { id }, data: { order: -1 * (index + 1) } })
      ),
      ...questionIds.map((id, index) =>
        app.prisma.question.update({ where: { id }, data: { order: index + 1 } })
      ),
    ]);

    const updated = await app.prisma.test.findUniqueOrThrow({ where: { id: test.id }, include: testDetailInclude });
    return serializeTest(updated);
  });

  app.get("/templates", adminAuth, async () => {
    const templates = await app.prisma.template.findMany({
      where: { isSystem: true },
      orderBy: { name: "asc" },
    });
    return {
      items: templates.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        structure: template.structure,
        isSystem: template.isSystem,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      })),
    };
  });

  app.post<{ Params: { templateId: string } }>("/tests/from-template/:templateId", adminAuth, async (request, reply) => {
    const template = await app.prisma.template.findUnique({ where: { id: request.params.templateId } });
    if (!template) return reply.status(404).send({ error: "NOT_FOUND", message: "Template not found" });

    const questions = templateQuestions(template.structure);
    const created = await app.prisma.test.create({
      data: {
        title: `${template.name} Draft`,
        description: template.description,
        status: "DRAFT",
        questions: {
          create: questions.map((question, index) => ({
            type: question.type ?? "SINGLE_SELECT",
            prompt: question.prompt ?? `Question ${index + 1}`,
            mediaType: question.mediaType ?? "TEXT",
            order: index + 1,
            config: inputJson(question.config ?? {}),
            options: {
              create: (question.options ?? []).map((option, optionIndex) =>
                typeof option === "string"
                  ? { label: option, order: optionIndex + 1 }
                  : { label: option.label ?? null, mediaId: option.mediaId ?? null, order: optionIndex + 1 }
              ),
            },
          })),
        },
      },
      include: testDetailInclude,
    });
    await recalculateReward(app, created.id);

    const updated = await app.prisma.test.findUniqueOrThrow({ where: { id: created.id }, include: testDetailInclude });
    return reply.status(201).send(serializeTest(updated));
  });
};
