import type { FastifyPluginAsync } from "fastify";

export const adminUsersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/users", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
};
