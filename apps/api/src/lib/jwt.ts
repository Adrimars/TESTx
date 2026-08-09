import jwt from "jsonwebtoken";
import type { UserRole } from "@testx/shared";

export type JwtPayload = {
  sub: string;
  role: UserRole;
};

/**
 * Issued when an evaluator opens a test, redeemed on submit. Carries the server's
 * view of when the session started so timing is never taken from the client.
 */
export type TestSessionPayload = {
  testId: string;
  userId: string;
  startedAt: string;
};

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-in-prod";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-in-prod";
const TEST_SESSION_SECRET =
  process.env.JWT_TEST_SESSION_SECRET ?? "dev-test-session-secret-change-in-prod";

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign({ sub: payload.sub, role: payload.role }, ACCESS_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign({ sub: payload.sub, role: payload.role }, REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, ACCESS_SECRET) as { sub: string; role: UserRole };
  return { sub: decoded.sub, role: decoded.role };
}

export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, REFRESH_SECRET) as { sub: string; role: UserRole };
  return { sub: decoded.sub, role: decoded.role };
}

export function signTestSessionToken(payload: TestSessionPayload): string {
  return jwt.sign(payload, TEST_SESSION_SECRET, { expiresIn: "12h" });
}

export function verifyTestSessionToken(token: string): TestSessionPayload {
  const decoded = jwt.verify(token, TEST_SESSION_SECRET) as TestSessionPayload;
  return { testId: decoded.testId, userId: decoded.userId, startedAt: decoded.startedAt };
}
