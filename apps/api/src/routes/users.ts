import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AVATAR_COUNT } from "@testx/shared";
import { buildCurrentUser } from "../services/auth.service";
import { clearAuthCookies } from "../lib/cookies";
import { authenticateUser } from "../middleware/authenticate";

const pushSubscriptionSchema = z.object({
  platform: z.enum(["IOS", "ANDROID", "WEB"]),
  /** An Expo push token for IOS/ANDROID, or a JSON-stringified Web Push subscription
   * (endpoint + keys) for WEB - opaque to the API either way until dispatch time. */
  token: z.string().min(1),
});

export const userRoutes: FastifyPluginAsync = async (app) => {
  /** The VAPID public key is not secret (it's handed to `PushManager.subscribe` in the
   * browser) - serving it here instead of duplicating it into apps/mobile's own env keeps
   * one source of truth on the server. Unauthenticated: needed before/while requesting the
   * browser's own notification permission, which happens before there is any reason to
   * gate it behind a session. */
  app.get("/push-vapid-key", async () => ({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null }));


  /** Currently only the avatar choice; profile fields live on /evaluator/profile. */
  app.patch("/me", { preHandler: [authenticateUser] }, async (request, reply) => {
    const { avatarId } = (request.body ?? {}) as { avatarId?: unknown };

    if (
      avatarId !== null &&
      (typeof avatarId !== "number" ||
        !Number.isInteger(avatarId) ||
        avatarId < 0 ||
        avatarId >= AVATAR_COUNT)
    ) {
      return reply.status(400).send({
        error: "BAD_REQUEST",
        message: `avatarId must be null or an integer between 0 and ${AVATAR_COUNT - 1}`,
      });
    }

    const user = await app.prisma.user.update({
      where: { id: request.user!.id },
      data: { avatarId },
      include: { evaluatorProfile: true },
    });

    return reply.send(buildCurrentUser(user));
  });

  /**
   * Self-service account deletion. Both Apple (Guideline 5.1.1(v)) and Google
   * Play require this to exist in-app the moment an app supports account
   * creation, with no "email support instead" carve-out for TESTx.
   *
   * EvaluatorProfile, TestResponse/Answer and MobileAuthCode all cascade from
   * User in the schema, so the row delete disposes of the evaluator's history
   * with it. Aggregate results already recorded against a test are unaffected
   * because they do not reference the user.
   */
  app.delete("/me", { preHandler: [authenticateUser] }, async (request, reply) => {
    await app.prisma.user.delete({ where: { id: request.user!.id } });

    // The web client authenticates by cookie, so clearing them here keeps a
    // browser session from lingering after the account is gone.
    clearAuthCookies(reply);
    return reply.status(204).send();
  });

  /**
   * Registers/refreshes one device's push destination (21.2). `token` is unique across the
   * whole table rather than scoped to this user - upserting on it means a device that gets
   * signed into a different account moves its subscription to that account instead of
   * leaving a stale row that would keep notifying the old one.
   */
  app.post("/me/push-subscription", { preHandler: [authenticateUser] }, async (request, reply) => {
    const { platform, token } = pushSubscriptionSchema.parse(request.body);

    const subscription = await app.prisma.pushSubscription.upsert({
      where: { token },
      create: { userId: request.user!.id, platform, token },
      update: { userId: request.user!.id, platform, lastUsedAt: new Date() },
    });

    return reply.status(200).send({ id: subscription.id });
  });

  /** Removes one device's push destination, e.g. on sign-out or notification-permission
   * revocation (21.5). Scoped to the caller's own userId so one account can't unregister
   * another's device by guessing its token; deleteMany makes the call idempotent either way. */
  app.delete("/me/push-subscription", { preHandler: [authenticateUser] }, async (request, reply) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(request.body);

    await app.prisma.pushSubscription.deleteMany({
      where: { token, userId: request.user!.id },
    });

    return reply.status(204).send();
  });
};
