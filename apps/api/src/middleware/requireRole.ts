import type { UserRole } from "@testx/shared";
import type { FastifyReply, FastifyRequest } from "fastify";

export function requireRole(role: UserRole) {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(501).send({
      error: "NOT_IMPLEMENTED",
      message: `Role guard for ${role} will be implemented in Phase 1.`,
    });
  };
}
