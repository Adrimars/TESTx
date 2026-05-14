import type { FastifyReply } from "fastify";
import type { Prisma } from "@testx/database";

type Media = Prisma.MediaGetPayload<Record<string, never>>;

export const driveService = {
  // Implemented in Phase 2.2
  async streamFile(_media: Media, reply: FastifyReply) {
    return reply.status(501).send({ error: "NOT_IMPLEMENTED", message: "Google Drive streaming not yet available" });
  },

  async importFolder(_folderUrl: string): Promise<{ count: number; items: Media[] }> {
    throw Object.assign(new Error("Google Drive import not yet available"), { statusCode: 501 });
  },
};
