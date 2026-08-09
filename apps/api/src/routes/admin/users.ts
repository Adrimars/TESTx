import type { FastifyPluginAsync } from "fastify";
import { authenticateUser } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { parsePageParams } from "../../lib/pagination";

const adminAuth = { preHandler: [authenticateUser, requireRole("ADMIN")] };

export const adminUsersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/users", adminAuth, async (request) => {
    const { page, limit, skip, take } = parsePageParams(
      request.query as { page?: string; limit?: string },
      25
    );

    const [users, total] = await Promise.all([
      app.prisma.user.findMany({
        where: { role: "EVALUATOR" },
        include: {
          evaluatorProfile: { select: { balance: true } },
          _count: { select: { responses: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      app.prisma.user.count({ where: { role: "EVALUATOR" } }),
    ]);

    return {
      items: users.map((user) => ({
        id: user.id,
        name: null,
        email: user.email,
        registeredAt: user.createdAt.toISOString(),
        testsCompleted: user._count.responses,
        totalPoints: user.evaluatorProfile?.balance ?? 0,
      })),
      total,
      page,
      limit,
    };
  });
};
