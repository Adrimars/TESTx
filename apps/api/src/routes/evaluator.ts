import type { FastifyPluginAsync } from "fastify";

export const evaluatorRoutes: FastifyPluginAsync = async (app) => {
  app.put("/profile", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.get("/next-test", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.get("/tests/:id", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.post("/tests/:id/submit", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.get("/balance", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
};
