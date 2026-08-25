import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { MediaType, QuestionInput, QuestionType, TestStatus } from "@testx/shared";
import {
  autoAttentionCheckCount,
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
import { parsePageParams } from "../../lib/pagination";

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
      media: true,
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
    mediaId: question.mediaId,
    media: question.media ? serializeMedia(question.media) : null,
    mediaUrl: question.mediaId ? `/media/${question.mediaId}/file` : null,
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
  // The two checks measure different things and would contradict each other: the attention
  // check demands one specific answer, the trap demands the answer given to another question.
  if (input.isAttentionCheck && input.isTrapDuplicate) {
    throw Object.assign(
      new Error("A question cannot be both an attention check and a trap duplicate"),
      { statusCode: 400 }
    );
  }

  // An attention check is graded by "was this exact option picked", which only a selection
  // answer can express: a rating has no options, and an ordering answer contains every one.
  if (input.isAttentionCheck && input.type !== "SINGLE_SELECT" && input.type !== "MULTI_SELECT") {
    throw Object.assign(
      new Error("Only single and multi select questions can be attention checks"),
      { statusCode: 400 }
    );
  }

  // An ordering question is answered by ranking its options, so it needs the same option
  // shape a selection question does.
  if (input.type === "SINGLE_SELECT" || input.type === "MULTI_SELECT" || input.type === "ORDERING") {
    const noun = input.type === "ORDERING" ? "Ordering" : "Selection";
    if (input.options.length < 2 || input.options.length > 10) {
      throw Object.assign(new Error(`${noun} questions require 2 to 10 options`), { statusCode: 400 });
    }
    for (const option of input.options) {
      if (!option.label && !option.mediaId) {
        throw Object.assign(new Error(`Each ${noun.toLowerCase()} option needs a label or media item`), {
          statusCode: 400,
        });
      }
    }
    return;
  }

  if (input.options.length > 0) {
    throw Object.assign(new Error("Rating questions cannot have options"), { statusCode: 400 });
  }
}

/**
 * The media a question is *about*. A rating question cannot carry options, so without this
 * there is nothing for an evaluator to rate — which is why a file media type makes it required.
 */
async function validateQuestionMedia(app: Parameters<FastifyPluginAsync>[0], input: QuestionInput) {
  const wantsMedia = input.mediaType && input.mediaType !== "TEXT";
  if (!input.mediaId) {
    if (input.type === "RATING" && wantsMedia) {
      throw Object.assign(new Error(`Rating questions on ${input.mediaType} need the media being rated`), {
        statusCode: 400,
      });
    }
    return;
  }

  const media = await app.prisma.media.findUnique({ where: { id: input.mediaId } });
  if (!media) {
    throw Object.assign(new Error("Question media was not found"), { statusCode: 400 });
  }
  if (wantsMedia && media.fileType !== input.mediaType) {
    throw Object.assign(new Error(`Question media ${media.fileName} does not match ${input.mediaType}`), {
      statusCode: 400,
    });
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

/**
 * Interior positions only — a check never opens or closes a test, where it is most obvious.
 * With 0 or 1 existing questions the only slot available is the final position.
 */
function interiorOrders(totalAfterInsert: number): number[] {
  const min = Math.min(2, totalAfterInsert);
  const max = Math.max(min, totalAfterInsert - 1);
  const orders: number[] = [];
  for (let order = min; order <= max; order += 1) orders.push(order);
  return orders;
}

/**
 * Positions that would not land the new check next to an existing one. Inserting at `order`
 * shifts everything from `order` down by one, so the neighbours of the new question are the
 * questions currently sitting at `order - 1` and `order`.
 */
function spacedOrders(candidates: number[], checkOrders: number[]): number[] {
  const taken = new Set(checkOrders);
  const spaced = candidates.filter((order) => !taken.has(order - 1) && !taken.has(order));
  return spaced.length > 0 ? spaced : candidates;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

type AttentionCheckSource = Prisma.QuestionGetPayload<{ include: { options: true } }>;

/**
 * A generated check copies an existing question's options and asks for one of them by name,
 * so it has to come from a question whose options *are* the answer set. Ordering and rating
 * questions cannot carry that shape.
 */
function attentionCheckSources(questions: AttentionCheckSource[]): AttentionCheckSource[] {
  return questions.filter(
    (question) =>
      !question.isAttentionCheck &&
      !question.isTrapDuplicate &&
      (question.type === "SINGLE_SELECT" || question.type === "MULTI_SELECT") &&
      question.options.length >= 2
  );
}

/**
 * Tops a test up to the attention-check quota its length earns (see `autoAttentionCheckCount`).
 *
 * Counts what is already there — manual checks included — and inserts only the shortfall, so
 * activating, pausing and reactivating a test does not stack up checks, and an admin who wrote
 * their own is left alone. Never removes anything.
 */
async function ensureAttentionChecks(app: Parameters<FastifyPluginAsync>[0], testId: string) {
  const questions = await app.prisma.question.findMany({
    where: { testId },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { order: "asc" } } },
  });

  const scoredCount = questions.filter((q) => !q.isAttentionCheck && !q.isTrapDuplicate).length;
  const existing = questions.filter((question) => question.isAttentionCheck);
  const missing = autoAttentionCheckCount(scoredCount) - existing.length;
  if (missing <= 0) return;

  const sources = attentionCheckSources(questions);
  // Live view of the test as we insert; positions shift under each insertion.
  let orders = questions.map((question) => question.order);
  let checkOrders = existing.map((question) => question.order);

  for (let index = 0; index < missing; index += 1) {
    const totalAfterInsert = orders.length + 1;
    const insertOrder = pickRandom(spacedOrders(interiorOrders(totalAfterInsert), checkOrders));

    // Shift questions at or after the chosen position to make room. Negative intermediates
    // avoid tripping the (testId, order) unique constraint mid-update.
    const toShift = orders.filter((order) => order >= insertOrder);
    if (toShift.length > 0) {
      await app.prisma.$transaction([
        ...toShift.map((order) =>
          app.prisma.question.updateMany({ where: { testId, order }, data: { order: -(order + 1) } })
        ),
        ...toShift.map((order) =>
          app.prisma.question.updateMany({ where: { testId, order: -(order + 1) }, data: { order: order + 1 } })
        ),
      ]);
    }

    // Different sources per check where the test offers them, so two checks never read alike.
    const source = sources.length > 0 ? sources[index % sources.length]! : undefined;
    await app.prisma.question.create({
      data: source
        ? {
            testId,
            type: "SINGLE_SELECT",
            prompt: `Attention check: select "${source.options[0]?.label ?? "the first option"}".`,
            mediaType: source.mediaType,
            order: insertOrder,
            isAttentionCheck: true,
            config: {
              autoGenerated: true,
              correctOptionOrder: source.options[0]?.order ?? 1,
              correctOptionLabel: source.options[0]?.label ?? null,
            },
            options: {
              create: source.options.map((option) => ({
                label: option.label,
                mediaId: option.mediaId,
                order: option.order,
              })),
            },
          }
        : {
            testId,
            type: "SINGLE_SELECT",
            prompt: "Attention check: select the option that says I am paying attention.",
            mediaType: "TEXT",
            order: insertOrder,
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

    checkOrders = [...checkOrders.map((order) => (order >= insertOrder ? order + 1 : order)), insertOrder];
    orders = [...orders.map((order) => (order >= insertOrder ? order + 1 : order)), insertOrder].sort(
      (a, b) => a - b
    );
  }
}

type TemplateQuestion = {
  type?: QuestionType;
  prompt?: string;
  mediaType?: MediaType;
  config?: Record<string, unknown>;
  options?: Array<string | { label?: string; mediaId?: string }>;
};

const templateQuestionZod = z.object({
  type: z.string().optional(),
  prompt: z.string().optional(),
  mediaType: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  options: z.array(z.union([z.string(), z.object({ label: z.string().optional(), mediaId: z.string().optional() })])).optional(),
});

const templateBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  structure: z.object({ questions: z.array(templateQuestionZod) }),
});

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
    const { status } = request.query as { status?: TestStatus };
    const { page, limit, skip, take } = parsePageParams(
      request.query as { page?: string; limit?: string },
      50
    );
    const where: Prisma.TestWhereInput = {};
    if (status && ["DRAFT", "ACTIVE", "PAUSED", "CLOSED"].includes(status)) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      app.prisma.test.findMany({
        where,
        include: testListInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      app.prisma.test.count({ where }),
    ]);

    return { items: items.map(serializeTestListItem), total, page, limit };
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
      await ensureAttentionChecks(app, existing.id);
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
    await validateQuestionMedia(app, body);
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
        mediaId: body.mediaId ?? null,
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
    await validateQuestionMedia(app, body);
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
          mediaId: body.mediaId ?? null,
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

  app.post("/templates", adminAuth, async (request, reply) => {
    const body = templateBodySchema.parse(request.body);
    const template = await app.prisma.template.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        structure: body.structure as Prisma.InputJsonValue,
        isSystem: true,
      },
    });
    return reply.status(201).send({
      id: template.id,
      name: template.name,
      description: template.description,
      structure: template.structure,
      isSystem: template.isSystem,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    });
  });

  app.put<{ Params: { id: string } }>("/templates/:id", adminAuth, async (request, reply) => {
    const body = templateBodySchema.partial().parse(request.body);
    const existing = await app.prisma.template.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND", message: "Template not found" });
    const template = await app.prisma.template.update({
      where: { id: request.params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.structure !== undefined && { structure: body.structure as Prisma.InputJsonValue }),
      },
    });
    return reply.send({
      id: template.id,
      name: template.name,
      description: template.description,
      structure: template.structure,
      isSystem: template.isSystem,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    });
  });

  app.delete<{ Params: { id: string } }>("/templates/:id", adminAuth, async (request, reply) => {
    const existing = await app.prisma.template.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND", message: "Template not found" });
    await app.prisma.template.delete({ where: { id: request.params.id } });
    return reply.status(204).send();
  });
};
