import type { FastifyPluginAsync } from "fastify";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (_request, reply) => {
    return reply.status(501).send({ error: "NOT_IMPLEMENTED" });
  });

  app.post("/login", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 minute",
      },
    },
  }, async (_request, reply) => {
    return reply.status(501).send({ error: "NOT_IMPLEMENTED" });
  });

  app.post("/logout", async (_request, reply) => {
    return reply.status(501).send({ error: "NOT_IMPLEMENTED" });
  });

  app.post("/refresh", async (_request, reply) => {
    return reply.status(501).send({ error: "NOT_IMPLEMENTED" });
  });

  app.get("/me", async (_request, reply) => {
    return reply.status(501).send({ error: "NOT_IMPLEMENTED" });
  });

  app.get("/google", async (_request, reply) => {
    return reply.status(501).send({ error: "NOT_IMPLEMENTED" });
  });

  app.get("/google/callback", async (_request, reply) => {
    return reply.status(501).send({ error: "NOT_IMPLEMENTED" });
  });
};
