import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";

export const rateLimitPlugin = fp(async (app) => {
  await app.register(rateLimit, {
    max: 60,
    timeWindow: "1 minute",
  });
});
