import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@testx/shared";
import { verifyAccessToken } from "../lib/jwt";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; role: UserRole };
  }
}

const BEARER_PREFIX = /^Bearer /i;

/**
 * Web apps authenticate with the `access_token` cookie; the mobile app has no
 * cookie jar and sends `Authorization: Bearer <token>` instead. The cookie is
 * checked first so existing web behaviour is unchanged.
 */
export function extractAccessToken(request: FastifyRequest): string | undefined {
  const cookieToken = request.cookies.access_token;
  if (cookieToken) return cookieToken;

  const header = request.headers.authorization;
  if (!header || !BEARER_PREFIX.test(header)) return undefined;

  return header.replace(BEARER_PREFIX, "").trim() || undefined;
}

export async function authenticateUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = extractAccessToken(request);
  if (!token) {
    return reply.status(401).send({ error: "UNAUTHORIZED", message: "Authentication required" });
  }
  try {
    const payload = verifyAccessToken(token);
    request.user = { id: payload.sub, role: payload.role };
  } catch {
    return reply.status(401).send({ error: "UNAUTHORIZED", message: "Invalid or expired token" });
  }
}
