import type { FastifyPluginAsync } from "fastify";
import { DEFAULT_MIN_APP_VERSION } from "@testx/shared";

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
