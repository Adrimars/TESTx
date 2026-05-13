import fp from "fastify-plugin";
import type { FastifyError } from "fastify";
import { ZodError } from "zod";

export const errorHandlerPlugin = fp(async (app) => {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "Request validation failed",
        issues: error.flatten(),
      });
    }

    const statusCode = error.statusCode ?? 500;
    const code = statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR";

    if (statusCode >= 500) {
      app.log.error(error);
    }

    return reply.status(statusCode).send({
      error: code,
      message: error.message,
    });
  });
});
