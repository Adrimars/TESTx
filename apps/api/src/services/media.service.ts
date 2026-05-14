import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@testx/database";
import type { FastifyReply } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import type { FileMediaType } from "@testx/shared";
import { driveService } from "./drive.service";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export function getUploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
}

export function getCacheDir(): string {
  return path.resolve(process.env.CACHE_DIR ?? "./cache/media");
}

function mimeToFileType(mimeType: string): FileMediaType | null {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return null;
}

function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/aac": "aac",
  };
  return map[mimeType] ?? (mimeType.split("/")[1] ?? "bin");
}

export async function uploadFile(prisma: PrismaClient, file: MultipartFile) {
  const fileType = mimeToFileType(file.mimetype);
  if (!fileType) {
    file.file.resume();
    throw Object.assign(new Error("Unsupported file type. Only images, videos, and audio are allowed."), {
      statusCode: 400,
    });
  }

  const uploadDir = getUploadDir();
  await fsPromises.mkdir(uploadDir, { recursive: true });

  const id = randomUUID();
  const ext = extFromMime(file.mimetype);
  const storedName = `${id}.${ext}`;
  const filePath = path.join(uploadDir, storedName);

  let fileSize = 0;
  const fileStream = fs.createWriteStream(filePath);

  try {
    for await (const chunk of file.file) {
      const buf = chunk as Buffer;
      fileSize += buf.length;
      if (fileSize > MAX_FILE_SIZE) {
        fileStream.destroy();
        throw Object.assign(new Error("File exceeds 100 MB size limit"), { statusCode: 413 });
      }
      if (!fileStream.write(buf)) {
        await new Promise<void>((resolve) => fileStream.once("drain", resolve));
      }
    }
    await new Promise<void>((resolve, reject) => {
      fileStream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
  } catch (err) {
    await fsPromises.unlink(filePath).catch(() => {});
    throw err;
  }

  const thumbnailUrl = fileType === "IMAGE" ? `/media/${id}/file` : null;

  return prisma.media.create({
    data: {
      id,
      fileName: file.filename || `upload.${ext}`,
      fileType,
      mimeType: file.mimetype,
      fileSize,
      sourceType: "UPLOAD",
      sourceUrl: filePath,
      thumbnailUrl,
      tags: [],
    },
  });
}

export async function listMedia(
  prisma: PrismaClient,
  query: { page?: number; limit?: number; fileType?: string; search?: string }
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));
  const skip = (page - 1) * limit;

  const where: Prisma.MediaWhereInput = {};
  if (query.fileType && ["IMAGE", "VIDEO", "AUDIO"].includes(query.fileType)) {
    where.fileType = query.fileType as FileMediaType;
  }
  if (query.search) {
    where.fileName = { contains: query.search, mode: "insensitive" };
  }

  const [items, total] = await Promise.all([
    prisma.media.findMany({ where, skip, take: limit, orderBy: { uploadedAt: "desc" } }),
    prisma.media.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function deleteMedia(prisma: PrismaClient, id: string) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) {
    throw Object.assign(new Error("Media not found"), { statusCode: 404 });
  }

  if (media.sourceType === "UPLOAD" && media.sourceUrl) {
    await fsPromises.unlink(media.sourceUrl).catch(() => {});
  } else if (media.sourceType === "GOOGLE_DRIVE") {
    const cacheDir = getCacheDir();
    const ext = media.mimeType ? extFromMime(media.mimeType) : "bin";
    const cachePath = path.join(cacheDir, `${media.id}.${ext}`);
    await fsPromises.unlink(cachePath).catch(() => {});
  }

  await prisma.media.delete({ where: { id } });
}

export async function serveMedia(prisma: PrismaClient, id: string, reply: FastifyReply) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) {
    return reply.status(404).send({ error: "NOT_FOUND", message: "Media not found" });
  }

  reply.header("Content-Type", media.mimeType);
  reply.header("Cache-Control", "public, max-age=86400");

  if (media.sourceType === "UPLOAD") {
    if (!media.sourceUrl) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "File not found on disk" });
    }
    try {
      await fsPromises.access(media.sourceUrl);
    } catch {
      return reply.status(404).send({ error: "NOT_FOUND", message: "File not found on disk" });
    }
    return reply.send(fs.createReadStream(media.sourceUrl));
  }

  // GOOGLE_DRIVE — delegate to drive service
  return driveService.streamFile(media as Parameters<typeof driveService.streamFile>[0], reply);
}
