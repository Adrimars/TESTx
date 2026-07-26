import type { FastifyPluginAsync } from "fastify";
import { authenticateUser } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";

const adminAuth = { preHandler: [authenticateUser, requireRole("ADMIN")] };

export const adminDashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/dashboard", adminAuth, async () => {
    const [totalEvaluators, activeTests, totalResponses, flaggedResponses, recentTests] =
      await Promise.all([
        app.prisma.user.count({ where: { role: "EVALUATOR" } }),
        app.prisma.test.count({ where: { status: "ACTIVE" } }),
        app.prisma.testResponse.count(),
        app.prisma.testResponse.count({ where: { isFlagged: true } }),
        app.prisma.test.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { responses: true } } },
        }),
      ]);

    return {
      totalEvaluators,
      activeTests,
      totalResponses,
      flaggedResponses,
      recentTests: recentTests.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        responseCount: t._count.responses,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  });
};
