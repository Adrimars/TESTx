import type { FastifyPluginAsync } from "fastify";

export const adminTemplatesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/templates", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
};
