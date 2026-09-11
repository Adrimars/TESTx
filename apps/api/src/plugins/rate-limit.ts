import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";
import Redis from "ioredis";

/**
 * The default in-memory store keeps its counters local to one process. The moment the
 * API runs as more than one instance, each instance enforces the limit independently —
 * a client hitting N instances behind a load balancer effectively gets `max * N`
 * requests/window, silently multiplying the allowed rate on the endpoints this is meant
 * to protect (`/auth/login`, `/auth/register`). `REDIS_URL` switches to a shared store;
 * unset, it falls back to in-memory and says so loudly rather than silently — a silent
 * fallback here would be the exact bug this exists to fix.
 */
export const rateLimitPlugin = fp(async (app) => {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const redis = new Redis(redisUrl, {
      // Fail fast rather than buffering requests indefinitely if Redis is unreachable;
      // @fastify/rate-limit's own `skipOnError` (default true) then lets requests
      // through rather than 500ing the whole API because the rate-limit store is down.
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
    });
    redis.on("error", (err) => {
      app.log.error({ err }, "rate-limit Redis connection error");
    });
    app.addHook("onClose", async () => {
      await redis.quit().catch(() => redis.disconnect());
    });

    app.log.info("rate-limit: using shared Redis store (REDIS_URL set)");
    await app.register(rateLimit, {
      max: 60,
      timeWindow: "1 minute",
      redis,
    });
    return;
  }

  app.log.warn(
    "rate-limit: REDIS_URL not set — using per-process in-memory store. " +
      "Safe at a single API instance only; set REDIS_URL before running more than one."
  );
  await app.register(rateLimit, {
    max: 60,
    timeWindow: "1 minute",
  });
});
