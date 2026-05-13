import type { FastifyPluginAsync } from "fastify";

export const adminMediaRoutes: FastifyPluginAsync = async (app) => {
  app.get("/media", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.post("/media/upload", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.post("/media/import-drive", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.delete("/media/:id", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
};
