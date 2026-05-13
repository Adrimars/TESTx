import type { FastifyPluginAsync } from "fastify";

export const adminDashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get("/dashboard", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
};
