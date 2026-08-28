import type { FastifyPluginAsync } from "fastify";
import { AVATAR_COUNT } from "@testx/shared";
import { buildCurrentUser } from "../services/auth.service";
import { clearAuthCookies } from "../lib/cookies";
import { authenticateUser } from "../middleware/authenticate";

export const userRoutes: FastifyPluginAsync = async (app) => {
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
};
