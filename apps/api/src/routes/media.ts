import type { FastifyPluginAsync } from "fastify";
import { serveMedia, serveThumbnail } from "../services/media.service";

export const publicMediaRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>("/:id/file", async (request, reply) => {
    return serveMedia(app.prisma, request.params.id, reply);
  });

  app.get<{ Params: { id: string } }>("/:id/thumbnail", async (request, reply) => {
    return serveThumbnail(app.prisma, request.params.id, reply);
  });
};
