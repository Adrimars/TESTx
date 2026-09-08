import fs from "node:fs";
import { Readable } from "node:stream";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { PrismaClient, Prisma } from "@testx/database";
import type { FastifyReply } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import type { FileMediaType } from "@testx/shared";
import { driveService } from "./drive.service";
import { getCacheDir, getThumbnailPath, getUploadDir, resolveUploadPath } from "../lib/media-paths";

type Media = Prisma.MediaGetPayload<Record<string, never>>;

const MAX_FILE_SIZE_BY_TYPE: Record<FileMediaType, number> = {
  IMAGE: 25 * 1024 * 1024,
  VIDEO: 500 * 1024 * 1024,
  AUDIO: 500 * 1024 * 1024,
};

const THUMBNAIL_MAX_DIMENSION = 480;
const inFlightThumbnails = new Map<string, Promise<string>>();

/**
 * Guarantees a resized webp thumbnail exists for `media` (IMAGE only — callers are
 * expected to check `fileType`) and returns its path, generating it on first request
 * from the original (the upload on disk, or the Drive-cached original, fetching it first
 * if needed). Finding 7 / plan.md 17.6: every client previously loaded the exact same
 * full-resolution original for every thumbnail-sized view regardless of source or size.
 */
export async function ensureThumbnail(media: Media): Promise<string> {
  const thumbPath = getThumbnailPath(media.id);

  try {
    await fsPromises.access(thumbPath);
    return thumbPath;
  } catch {
    // cache miss — generate
  }

  const existing = inFlightThumbnails.get(media.id);
  if (existing) return existing;

  const task = generateThumbnail(media, thumbPath).finally(() => {
    inFlightThumbnails.delete(media.id);
  });
  inFlightThumbnails.set(media.id, task);
  return task;
}

async function generateThumbnail(media: Media, thumbPath: string): Promise<string> {
  const sourcePath =
    media.sourceType === "UPLOAD" && media.sourceUrl
      ? resolveUploadPath(media.sourceUrl)
      : await driveService.ensureCachedFile(media as Parameters<typeof driveService.ensureCachedFile>[0]);

  await fsPromises.mkdir(getCacheDir(), { recursive: true });
  const tempPath = `${thumbPath}.${randomUUID()}.tmp`;
  try {
    await sharp(sourcePath)
      .resize(THUMBNAIL_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(tempPath);
    await fsPromises.rename(tempPath, thumbPath);
  } catch (err) {
    await fsPromises.unlink(tempPath).catch(() => {});
    throw err;
  }
  return thumbPath;
}

export async function serveThumbnail(prisma: PrismaClient, id: string, reply: FastifyReply) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) {
    return reply.status(404).send({ error: "NOT_FOUND", message: "Media not found" });
  }
  if (media.fileType !== "IMAGE") {
    return reply.status(404).send({ error: "NOT_FOUND", message: "No thumbnail for this file type" });
  }

  let thumbPath: string;
  try {
    thumbPath = await ensureThumbnail(media);
  } catch {
    return reply.status(502).send({ error: "THUMBNAIL_ERROR", message: "Failed to generate thumbnail" });
  }

  reply.header("Content-Type", "image/webp");
  reply.header("Cache-Control", "public, max-age=86400");
  return reply.send(Readable.toWeb(fs.createReadStream(thumbPath)));
}

/**
 * Caps `dir`'s total size by deleting least-recently-accessed files first. Nothing in
 * `cache/media` is authoritative data — Drive originals are re-fetchable, thumbnails are
 * regeneratable — so eviction here is always safe, unlike `uploads/`.
 *
 * In-progress downloads (`*.tmp`, see `drive.service.ts`) are left alone; they're not
 * yet part of the served cache and will rename into place or be cleaned up on failure.
 */
export async function enforceCacheSizeLimit(dir: string, maxBytes: number): Promise<void> {
  let entries: string[];
  try {
    entries = await fsPromises.readdir(dir);
  } catch {
    return;
  }

  const stats = await Promise.all(
    entries
      .filter((name) => !name.endsWith(".tmp"))
      .map(async (name) => {
        const filePath = path.join(dir, name);
        try {
          const stat = await fsPromises.stat(filePath);
          return { filePath, size: stat.size, atimeMs: stat.atimeMs };
        } catch {
          return null;
        }
      })
  );
  const files = stats.filter((f): f is { filePath: string; size: number; atimeMs: number } => f !== null);

  let remaining = files.reduce((sum, f) => sum + f.size, 0);
  if (remaining <= maxBytes) return;

  files.sort((a, b) => a.atimeMs - b.atimeMs);
  for (const file of files) {
    if (remaining <= maxBytes) break;
    await fsPromises.unlink(file.filePath).catch(() => {});
    remaining -= file.size;
  }
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

function formatLimit(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export async function uploadFile(prisma: PrismaClient, file: MultipartFile) {
  const fileType = mimeToFileType(file.mimetype);
  if (!fileType) {
    file.file.resume();
    throw Object.assign(new Error("Unsupported file type. Only images, videos, and audio are allowed."), {
      statusCode: 400,
    });
  }
  const maxFileSize = MAX_FILE_SIZE_BY_TYPE[fileType];

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
      if (fileSize > maxFileSize) {
        fileStream.destroy();
        throw Object.assign(new Error(`File exceeds ${formatLimit(maxFileSize)} size limit`), { statusCode: 413 });
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

  const thumbnailUrl = fileType === "IMAGE" ? `/media/${id}/thumbnail` : null;

  return prisma.media.create({
    data: {
      id,
      fileName: file.filename || `upload.${ext}`,
      fileType,
      mimeType: file.mimetype,
      fileSize,
      sourceType: "UPLOAD",
      // Relative to the upload root, so the row survives the project moving.
      sourceUrl: storedName,
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
    await fsPromises.unlink(resolveUploadPath(media.sourceUrl)).catch(() => {});
  } else if (media.sourceType === "GOOGLE_DRIVE") {
    const cacheDir = getCacheDir();
    const ext = media.mimeType ? extFromMime(media.mimeType) : "bin";
    const cachePath = path.join(cacheDir, `${media.id}.${ext}`);
    await fsPromises.unlink(cachePath).catch(() => {});
  }

  // Thumbnails apply to both sources (17.6) — clean up regardless of sourceType.
  if (media.fileType === "IMAGE") {
    await fsPromises.unlink(getThumbnailPath(media.id)).catch(() => {});
  }

  await prisma.media.delete({ where: { id } });
}

export async function serveMedia(prisma: PrismaClient, id: string, reply: FastifyReply) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) {
    return reply.status(404).send({ error: "NOT_FOUND", message: "Media not found" });
  }

  if (media.sourceType === "UPLOAD") {
    if (!media.sourceUrl) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "File not found on disk" });
    }
    const absolutePath = resolveUploadPath(media.sourceUrl);
    try {
      await fsPromises.access(absolutePath);
    } catch {
      return reply.status(404).send({ error: "NOT_FOUND", message: "File not found on disk" });
    }
    reply.header("Content-Type", media.mimeType);
    reply.header("Cache-Control", "public, max-age=86400");
    return reply.send(Readable.toWeb(fs.createReadStream(absolutePath)));
  }

  // GOOGLE_DRIVE — delegate to drive service
  reply.header("Content-Type", media.mimeType);
  reply.header("Cache-Control", "public, max-age=86400");
  return driveService.streamFile(media as Parameters<typeof driveService.streamFile>[0], reply);
}
