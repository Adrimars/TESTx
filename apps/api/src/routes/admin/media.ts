import type { FastifyPluginAsync } from "fastify";
import { authenticateUser } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { uploadFile, listMedia, deleteMedia } from "../../services/media.service";
import { driveService } from "../../services/drive.service";

const adminAuth = { preHandler: [authenticateUser, requireRole("ADMIN")] };

export const adminMediaRoutes: FastifyPluginAsync = async (app) => {
  app.get("/media", adminAuth, async (request, reply) => {
    const { page, limit, fileType, search } = request.query as {
      page?: string;
      limit?: string;
      fileType?: string;
      search?: string;
    };

    const result = await listMedia(app.prisma, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      fileType,
      search,
    });

    return reply.send(result);
  });

  app.post("/media/upload", adminAuth, async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "No file provided" });
    }

    const media = await uploadFile(app.prisma, file);
    return reply.status(201).send(media);
  });

  app.post("/media/import-drive", adminAuth, async (request, reply) => {
    const { folderUrl } = request.body as { folderUrl?: string };
    if (!folderUrl || typeof folderUrl !== "string") {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "folderUrl is required" });
    }

    try {
      const result = await driveService.importFolder(app.prisma, folderUrl);
      return reply.status(201).send(result);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      const status = e.statusCode ?? 500;
      const message = e.message ?? "Import failed";
      if (status === 400) {
        return reply.status(400).send({ error: "BAD_REQUEST", message });
      }
      if (status === 502) {
        return reply.status(502).send({ error: "DRIVE_ERROR", message });
      }
      throw err;
    }
  });

  app.delete<{ Params: { id: string } }>("/media/:id", adminAuth, async (request, reply) => {
    await deleteMedia(app.prisma, request.params.id);
    return reply.status(204).send();
  });
};
