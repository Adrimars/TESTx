import type { FastifyPluginAsync } from "fastify";

export const adminTestsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/tests", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.post("/tests", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.get("/tests/:id", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.put("/tests/:id", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.delete("/tests/:id", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.put("/tests/:id/status", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.get("/tests/:id/preview", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.get("/tests/:id/results", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.get("/tests/:id/results/demographics", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.post("/tests/:id/questions", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.put("/tests/:id/questions/reorder", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.put("/questions/:id", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.delete("/questions/:id", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.post("/tests/from-template/:templateId", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
};
