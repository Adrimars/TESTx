import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@testx/shared";
import { verifyAccessToken } from "../lib/jwt";

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; role: UserRole };
  }
}

export async function authenticateUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies.access_token;
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
