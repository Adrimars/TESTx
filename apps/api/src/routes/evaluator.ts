import type { FastifyPluginAsync } from "fastify";
import { evaluatorProfileSchema } from "@testx/shared";
import { authenticateUser } from "../middleware/authenticate";

export const evaluatorRoutes: FastifyPluginAsync = async (app) => {
  app.put("/profile", { preHandler: [authenticateUser] }, async (request, reply) => {
    const body = evaluatorProfileSchema.parse(request.body);

    const profile = await app.prisma.evaluatorProfile.upsert({
      where: { userId: request.user!.id },
      update: {
        dateOfBirth: new Date(body.dateOfBirth),
        gender: body.gender,
        country: body.country,
        city: body.city ?? null,
      },
      create: {
        userId: request.user!.id,
        dateOfBirth: new Date(body.dateOfBirth),
        gender: body.gender,
        country: body.country,
        city: body.city ?? null,
      },
    });

    return reply.send(profile);
  });

  app.get("/next-test", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.get("/tests/:id", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.post("/tests/:id/submit", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
  app.get("/balance", async (_request, reply) => reply.status(501).send({ error: "NOT_IMPLEMENTED" }));
};
