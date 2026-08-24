import type { FastifyPluginAsync } from "fastify";

/**
 * Minimum app version the API will serve.
 *
 * The question-type set grows over time (Ranking in Phase 13, more later). An
 * older build that does not know how to render a new QuestionType must be
 * forced to update rather than allowed to break mid-feed, so this is bumped as
 * part of shipping any new question type. See plan.md 9.6.
 */
const DEFAULT_MIN_APP_VERSION = "1.0.0";

export const mobileRoutes: FastifyPluginAsync = async (app) => {
  app.get("/min-version", async (_request, reply) => {
    return reply.send({
      minVersion: process.env.MOBILE_MIN_APP_VERSION ?? DEFAULT_MIN_APP_VERSION,
      // Where to send the user when their build is too old.
      storeUrls: {
        ios: process.env.MOBILE_IOS_STORE_URL ?? null,
        android: process.env.MOBILE_ANDROID_STORE_URL ?? null,
      },
    });
  });
};
