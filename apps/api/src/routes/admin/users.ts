import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { authenticateUser } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";

const adminAuth = { preHandler: [authenticateUser, requireRole("ADMIN")] };

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const adminUsersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/users", adminAuth, async (request) => {
    const { page: currentPage, limit: pageSize } = listUsersQuerySchema.parse(request.query);

    const [users, total] = await Promise.all([
      app.prisma.user.findMany({
        where: { role: "EVALUATOR" },
        orderBy: { createdAt: "desc" },
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
        include: {
          evaluatorProfile: { select: { balance: true } },
          _count: { select: { responses: true } },
        },
      }),
      app.prisma.user.count({ where: { role: "EVALUATOR" } }),
    ]);

    return {
      items: users.map((u) => ({
        id: u.id,
        email: u.email,
        createdAt: u.createdAt.toISOString(),
        testsCompleted: u._count.responses,
        totalPoints: u.evaluatorProfile?.balance ?? 0,
      })),
      total,
      page: currentPage,
      limit: pageSize,
    };
  });
};
