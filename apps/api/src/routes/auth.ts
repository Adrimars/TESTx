import type { FastifyPluginAsync } from "fastify";
import { registerSchema, loginSchema } from "@testx/shared";
import {
  hashPassword,
  comparePassword,
  buildCurrentUser,
  getGoogleOAuthUrl,
  handleGoogleCallback,
} from "../services/auth.service";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { setAuthCookies, clearAuthCookies } from "../lib/cookies";
import { authenticateUser } from "../middleware/authenticate";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/register", async (request, reply) => {
    const { email, password } = registerSchema.parse(request.body);

    const existing = await app.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: "CONFLICT", message: "Email already registered" });
    }

    const passwordHash = await hashPassword(password);
    const user = await app.prisma.user.create({
      data: { email, passwordHash, role: "EVALUATOR", isVerified: true },
      include: { evaluatorProfile: true },
    });

    const payload = { sub: user.id, role: user.role };
    setAuthCookies(reply, signAccessToken(payload), signRefreshToken(payload));
    return reply.status(201).send(buildCurrentUser(user));
  });

  app.post(
    "/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { email, password } = loginSchema.parse(request.body);

      const user = await app.prisma.user.findUnique({
        where: { email },
        include: { evaluatorProfile: true },
      });

      if (!user || !user.passwordHash || !(await comparePassword(password, user.passwordHash))) {
        return reply.status(401).send({ error: "UNAUTHORIZED", message: "Invalid credentials" });
      }

      const payload = { sub: user.id, role: user.role };
      setAuthCookies(reply, signAccessToken(payload), signRefreshToken(payload));
      return reply.send(buildCurrentUser(user));
    }
  );

  app.post("/logout", async (_request, reply) => {
    clearAuthCookies(reply);
    return reply.send({ ok: true });
  });

  app.post("/refresh", async (request, reply) => {
    const token = request.cookies.refresh_token;
    if (!token) {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "No refresh token" });
    }

    try {
      const payload = verifyRefreshToken(token);
      const user = await app.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) {
        return reply.status(404).send({ error: "NOT_FOUND", message: "User not found" });
      }
      const newAccessToken = signAccessToken({ sub: user.id, role: user.role });
      reply.setCookie("access_token", newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 15 * 60,
      });
      return reply.send({ ok: true });
    } catch {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Invalid refresh token" });
    }
  });

  app.get("/me", { preHandler: [authenticateUser] }, async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.user!.id },
      include: { evaluatorProfile: true },
    });
    if (!user) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "User not found" });
    }
    return reply.send(buildCurrentUser(user));
  });

  app.get("/google", async (_request, reply) => {
    return reply.redirect(getGoogleOAuthUrl());
  });

  app.get("/google/callback", async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "Missing code parameter" });
    }

    try {
      const currentUser = await handleGoogleCallback(app.prisma, code);
      const payload = { sub: currentUser.id, role: currentUser.role };
      setAuthCookies(reply, signAccessToken(payload), signRefreshToken(payload));
      const redirectUrl = process.env.EVALUATOR_APP_URL ?? "http://localhost:3000";
      return reply.redirect(`${redirectUrl}/dashboard`);
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({ error: "INTERNAL_SERVER_ERROR", message: "OAuth failed" });
    }
  });
};
