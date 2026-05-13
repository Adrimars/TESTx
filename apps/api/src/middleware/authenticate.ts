import type { FastifyReply, FastifyRequest } from "fastify";

export async function authenticateUser(_request: FastifyRequest, reply: FastifyReply) {
  return reply.status(501).send({
    error: "NOT_IMPLEMENTED",
    message: "Authentication middleware will be implemented in Phase 1.",
  });
}
