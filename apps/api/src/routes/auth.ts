import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { registerSchema, loginSchema, mobileRegisterSchema } from "@testx/shared";
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
import { issueMobileAuthCode, consumeMobileAuthCode } from "../services/mobileAuth.service";

const BEARER_PREFIX = /^Bearer /i;

/**
 * Web sends the refresh token as an httpOnly cookie. The mobile app holds it in
 * secure storage and presents it in the request body (or as a bearer header),
 * so both are accepted, cookie first.
 */
function extractRefreshToken(request: FastifyRequest): string | undefined {
  const cookieToken = request.cookies.refresh_token;
  if (cookieToken) return cookieToken;

  const body = request.body as { refreshToken?: unknown } | undefined;
  if (typeof body?.refreshToken === "string" && body.refreshToken.trim()) {
    return body.refreshToken.trim();
  }

  const header = request.headers.authorization;
  if (header && BEARER_PREFIX.test(header)) {
    return header.replace(BEARER_PREFIX, "").trim() || undefined;
  }

  return undefined;
}

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
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    setAuthCookies(reply, accessToken, refreshToken);
    return reply.status(201).send({ ...buildCurrentUser(user), accessToken, refreshToken });
  });

  /**
   * Mobile registration. Separate from /register because it carries the KVKK
   * steps and the 18+ gate, neither of which applies to web registration
   * (prd.md 15.11 keeps that flow untouched).
   */
  app.post(
    "/register/mobile",
    // Tighter than the global default because this endpoint creates accounts,
    // but deliberately not as tight as /login: registrations from one office or
    // campus share a NAT address, and 9.5 already chose flagging over blocking
    // as the answer to farming. This is defence in depth, not the gate.
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const input = mobileRegisterSchema.parse(request.body);

    const existing = await app.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      return reply.status(409).send({ error: "CONFLICT", message: "Email already registered" });
    }

    // A points-for-answers economy invites one person farming rewards through
    // several accounts. A repeat device is flagged for review, never blocked -
    // shared and family devices are legitimate, and a false positive here would
    // lock out a real evaluator.
    const isDeviceFlagged = input.deviceId
      ? (await app.prisma.user.count({ where: { registrationDeviceId: input.deviceId } })) > 0
      : false;

    const now = new Date();
    const passwordHash = await hashPassword(input.password);
    const user = await app.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: "EVALUATOR",
        isVerified: true,
        aydinlatmaAcknowledgedAt: now,
        // Only stamped when explicit consent was actually given. Declining it
        // must not block registration, so this stays null in that case.
        acikRizaAcceptedAt: input.acikRizaAccepted ? now : null,
        registrationDeviceId: input.deviceId ?? null,
        isDeviceFlagged,
      },
      include: { evaluatorProfile: true },
    });

    if (isDeviceFlagged) {
      app.log.warn({ userId: user.id }, "registration from a device that already has an account");
    }

    const payload = { sub: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    setAuthCookies(reply, accessToken, refreshToken);
    return reply.status(201).send({ ...buildCurrentUser(user), accessToken, refreshToken });
    }
  );

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
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);
      setAuthCookies(reply, accessToken, refreshToken);
      return reply.send({ ...buildCurrentUser(user), accessToken, refreshToken });
    }
  );

  app.post("/logout", async (_request, reply) => {
    clearAuthCookies(reply);
    return reply.send({ ok: true });
  });

  app.post("/refresh", async (request, reply) => {
    const token = extractRefreshToken(request);
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
      // The refresh token is not rotated (web behaviour is unchanged); it is
      // echoed back so cookie-less clients can keep storing a single pair.
      return reply.send({ ok: true, accessToken: newAccessToken, refreshToken: token });
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

  app.get("/google", async (request, reply) => {
    const { platform } = request.query as { platform?: string };
    // The state round-trips through Google so the callback knows whether to
    // finish in a browser (web) or hand back to the app via a deep link.
    return reply.redirect(getGoogleOAuthUrl(platform === "mobile" ? "mobile" : undefined));
  });

  /**
   * Exchanges the one-time code delivered to the app's deep link for a token
   * pair. Tokens are deliberately never placed in the redirect URL itself,
   * which would leak them into OS logs and browser history.
   */
  app.post(
    "/google/exchange",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
    const { code } = (request.body ?? {}) as { code?: unknown };
    if (typeof code !== "string" || !code) {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "Missing code" });
    }

    const userId = await consumeMobileAuthCode(app.prisma, code);
    if (!userId) {
      return reply
        .status(401)
        .send({ error: "UNAUTHORIZED", message: "Invalid or expired code" });
    }

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      include: { evaluatorProfile: true },
    });
    if (!user) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "User not found" });
    }

    const payload = { sub: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    return reply.send({ ...buildCurrentUser(user), accessToken, refreshToken });
    }
  );

  app.get("/google/callback", async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "Missing code parameter" });
    }

    try {
      const currentUser = await handleGoogleCallback(app.prisma, code);

      const { state } = request.query as { state?: string };
      if (state === "mobile") {
        const authCode = await issueMobileAuthCode(app.prisma, currentUser.id);
        const scheme = process.env.MOBILE_APP_SCHEME ?? "testx";
        return reply.redirect(`${scheme}://auth?code=${encodeURIComponent(authCode)}`);
      }

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
