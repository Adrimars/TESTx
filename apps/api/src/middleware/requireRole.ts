import type { UserRole } from "@testx/shared";
import type { FastifyReply, FastifyRequest } from "fastify";

export function requireRole(role: UserRole) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user || request.user.role !== role) {
      return reply.status(403).send({ error: "FORBIDDEN", message: "Insufficient permissions" });
    }
  };
}
