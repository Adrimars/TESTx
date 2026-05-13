import type { FastifyPluginAsync } from "fastify";

export const publicMediaRoutes: FastifyPluginAsync = async (app) => {
  app.get("/:id/file", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
};
