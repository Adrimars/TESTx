import fs from "node:fs";
import { Readable } from "node:stream";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { PrismaClient, Prisma } from "@testx/database";
import type { FastifyReply } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import type { FileMediaType, MediaType } from "@testx/shared";
import { TEXT_MAX_CHARS, TEXT_MAX_FILE_BYTES, JSON_MAX_CHARS, JSON_MAX_FILE_BYTES } from "@testx/shared";
import { driveService } from "./drive.service";
import { getCacheDir, getThumbnailPath, getUploadDir, resolveUploadPath } from "../lib/media-paths";

type Media = Prisma.MediaGetPayload<Record<string, never>>;

// ---------------------------------------------------------------------------
// Type widened to include TEXT
// ---------------------------------------------------------------------------

type AllMediaType = FileMediaType | "TEXT" | "JSON";

const MAX_FILE_SIZE_BY_TYPE: Record<AllMediaType, number> = {
  IMAGE: 25 * 1024 * 1024,
  VIDEO: 500 * 1024 * 1024,
  AUDIO: 500 * 1024 * 1024,
  TEXT: TEXT_MAX_FILE_BYTES,
  JSON: JSON_MAX_FILE_BYTES,
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

// ---------------------------------------------------------------------------
// MIME helpers
// ---------------------------------------------------------------------------

function mimeToMediaType(mimeType: string): AllMediaType | null {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  if (mimeType === "text/plain") return "TEXT";
  if (mimeType === "application/json") return "JSON";
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
    "text/plain": "txt",
    "application/json": "json",
  };
  return map[mimeType] ?? (mimeType.split("/")[1] ?? "bin");
}

function formatLimit(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

// ---------------------------------------------------------------------------
// Binary detection for text files
// ---------------------------------------------------------------------------

/** Returns true when the buffer looks like a binary file (has null bytes in the first 512 bytes). */
function looksLikeBinary(buf: Buffer): boolean {
  const sample = buf.slice(0, Math.min(512, buf.length));
  return sample.includes(0x00);
}

// ---------------------------------------------------------------------------
// Auto-suffix helper for name collisions
// ---------------------------------------------------------------------------

/**
 * If fileName already exists in the given folder, returns "name (1).ext", "(2)", etc.
 * Works for both TEXT media (no disk extension) and file media.
 */
async function resolveFileName(
  prisma: PrismaClient,
  fileName: string,
  folderId: string | null,
): Promise<string> {
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : "";

  let candidate = fileName;
  let attempt = 0;
  while (true) {
    const existing = await prisma.media.findFirst({
      where: { fileName: candidate, folderId: folderId ?? null },
      select: { id: true },
    });
    if (!existing) return candidate;
    attempt++;
    candidate = `${base} (${attempt})${ext}`;
  }
}

// ---------------------------------------------------------------------------
// Core upload (from MultipartFile stream)
// ---------------------------------------------------------------------------

export async function uploadFile(
  prisma: PrismaClient,
  file: MultipartFile,
  folderId: string | null = null,
) {
  const mediaType = mimeToMediaType(file.mimetype);
  if (!mediaType) {
    file.file.resume();
    throw Object.assign(
      new Error("Unsupported file type. Allowed: images, videos, audio, and plain text (.txt)."),
      { statusCode: 400 }
    );
  }
  const maxFileSize = MAX_FILE_SIZE_BY_TYPE[mediaType];
  const uploadDir = getUploadDir();
  await fsPromises.mkdir(uploadDir, { recursive: true });

  const id = randomUUID();
  const ext = extFromMime(file.mimetype);
  const storedName = `${id}.${ext}`;
  const filePath = path.join(uploadDir, storedName);

  let fileSize = 0;
  const chunks: Buffer[] = [];
  const fileStream = fs.createWriteStream(filePath);

  try {
    for await (const chunk of file.file) {
      const buf = chunk as Buffer;
      fileSize += buf.length;
      if (fileSize > maxFileSize) {
        fileStream.destroy();
        throw Object.assign(
          new Error(`File exceeds ${formatLimit(maxFileSize)} size limit`),
          { statusCode: 413 }
        );
      }
      if (mediaType === "TEXT" || mediaType === "JSON") chunks.push(buf); // collect for content extraction
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

  // TEXT / JSON content extraction
  let textContent: string | null = null;
  if (mediaType === "TEXT" || mediaType === "JSON") {
    const raw = Buffer.concat(chunks);
    if (looksLikeBinary(raw)) {
      await fsPromises.unlink(filePath).catch(() => {});
      throw Object.assign(
        new Error("File appears to be binary, not plain text. Only UTF-8 text is accepted."),
        { statusCode: 400 }
      );
    }
    const decoded = raw.toString("utf-8");
    const maxChars = mediaType === "JSON" ? JSON_MAX_CHARS : TEXT_MAX_CHARS;
    if (decoded.length > maxChars) {
      await fsPromises.unlink(filePath).catch(() => {});
      throw Object.assign(
        new Error(`Content exceeds ${maxChars.toLocaleString()} character limit.`),
        { statusCode: 413 }
      );
    }
    if (mediaType === "JSON") {
      try { JSON.parse(decoded); } catch {
        await fsPromises.unlink(filePath).catch(() => {});
        throw Object.assign(new Error("File is not valid JSON."), { statusCode: 400 });
      }
    }
    textContent = decoded;
  }

  const thumbnailUrl = mediaType === "IMAGE" ? `/media/${id}/thumbnail` : null;
  const fileName = await resolveFileName(prisma, file.filename || `upload.${ext}`, folderId);

  return prisma.media.create({
    data: {
      id,
      fileName,
      fileType: mediaType,
      mimeType: file.mimetype,
      fileSize,
      sourceType: "UPLOAD",
      sourceUrl: storedName,
      thumbnailUrl,
      tags: [],
      folderId: folderId ?? null,
      textContent,
    },
  });
}

// ---------------------------------------------------------------------------
// Upload from an in-memory Buffer (used by folder-upload and zip extraction)
// ---------------------------------------------------------------------------

export async function uploadBuffer(
  prisma: PrismaClient,
  buf: Buffer,
  fileName: string,
  folderId: string | null = null,
): Promise<object> {
  // Detect MIME from extension
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const extToMime: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", aac: "audio/aac",
    txt: "text/plain",
    json: "application/json",
  };
  const mimeType = extToMime[ext];
  if (!mimeType) {
    throw Object.assign(
      new Error(`Unsupported file extension ".${ext}" for "${fileName}".`),
      { statusCode: 400 }
    );
  }

  const mediaType = mimeToMediaType(mimeType);
  if (!mediaType) {
    throw Object.assign(new Error(`Unsupported MIME type "${mimeType}".`), { statusCode: 400 });
  }

  const maxSize = MAX_FILE_SIZE_BY_TYPE[mediaType];
  if (buf.length > maxSize) {
    throw Object.assign(
      new Error(`"${fileName}" exceeds ${formatLimit(maxSize)} size limit.`),
      { statusCode: 413 }
    );
  }

  let textContent: string | null = null;
  if (mediaType === "TEXT" || mediaType === "JSON") {
    if (looksLikeBinary(buf)) {
      throw Object.assign(
        new Error(`"${fileName}" appears to be binary, not plain text.`),
        { statusCode: 400 }
      );
    }
    const decoded = buf.toString("utf-8");
    const maxChars = mediaType === "JSON" ? JSON_MAX_CHARS : TEXT_MAX_CHARS;
    if (decoded.length > maxChars) {
      throw Object.assign(
        new Error(`"${fileName}" content exceeds ${maxChars.toLocaleString()} characters.`),
        { statusCode: 413 }
      );
    }
    if (mediaType === "JSON") {
      try { JSON.parse(decoded); } catch {
        throw Object.assign(new Error(`"${fileName}" is not valid JSON.`), { statusCode: 400 });
      }
    }
    textContent = decoded;
  }

  const uploadDir = getUploadDir();
  await fsPromises.mkdir(uploadDir, { recursive: true });

  const id = randomUUID();
  const storedName = `${id}.${ext}`;
  const filePath = path.join(uploadDir, storedName);
  await fsPromises.writeFile(filePath, buf);

  const thumbnailUrl = mediaType === "IMAGE" ? `/media/${id}/file` : null;
  const resolvedName = await resolveFileName(prisma, fileName, folderId);

  return prisma.media.create({
    data: {
      id,
      fileName: resolvedName,
      fileType: mediaType,
      mimeType,
      fileSize: buf.length,
      sourceType: "UPLOAD",
      sourceUrl: storedName,
      thumbnailUrl,
      tags: [],
      folderId: folderId ?? null,
      textContent,
    },
  });
}

// ---------------------------------------------------------------------------
// Paste text (no file)
// ---------------------------------------------------------------------------

export async function pasteText(
  prisma: PrismaClient,
  name: string,
  content: string,
  folderId: string | null = null,
) {
  name = name.trim();
  if (!name) {
    throw Object.assign(new Error("Name is required."), { statusCode: 400 });
  }
  if (content.length > TEXT_MAX_CHARS) {
    throw Object.assign(
      new Error(`Text content exceeds ${TEXT_MAX_CHARS.toLocaleString()} character limit.`),
      { statusCode: 413 }
    );
  }

  // Store a .txt file on disk for provenance / download
  const id = randomUUID();
  const storedName = `${id}.txt`;
  const filePath = path.join(getUploadDir(), storedName);
  await fsPromises.mkdir(getUploadDir(), { recursive: true });
  await fsPromises.writeFile(filePath, content, "utf-8");

  const fileSize = Buffer.byteLength(content, "utf-8");
  const fileName = await resolveFileName(
    prisma,
    name.endsWith(".txt") ? name : `${name}.txt`,
    folderId,
  );

  return prisma.media.create({
    data: {
      id,
      fileName,
      fileType: "TEXT",
      mimeType: "text/plain",
      fileSize,
      sourceType: "UPLOAD",
      sourceUrl: storedName,
      thumbnailUrl: null,
      tags: [],
      folderId: folderId ?? null,
      textContent: content,
    },
  });
}

// ---------------------------------------------------------------------------
// Folder upload (multiple files with relative paths)
// ---------------------------------------------------------------------------

export type FolderUploadEntry = {
  relativePath: string;
  buffer: Buffer;
  fileName: string;
};

export async function folderUpload(
  prisma: PrismaClient,
  entries: FolderUploadEntry[],
  rootFolderId: string | null = null,
) {
  const { ensureFolderPath } = await import("./folder.service");
  const results: Array<{ path: string; media?: object; error?: string }> = [];
  const foldersCreatedSet = new Set<string>();

  for (const entry of entries) {
    const segments = entry.relativePath.split(/[\\/]/).filter(Boolean);
    segments.pop(); // remove fileName part

    // Skip hidden / system files
    if (entry.fileName.startsWith(".") || entry.fileName === "__MACOSX") {
      continue;
    }

    let targetFolderId: string | null = rootFolderId;
    if (segments.length > 0) {
      try {
        targetFolderId = await ensureFolderPath(prisma, segments, rootFolderId);
        if (targetFolderId) foldersCreatedSet.add(targetFolderId);
      } catch (err: unknown) {
        results.push({ path: entry.relativePath, error: err instanceof Error ? err.message : "Folder error" });
        continue;
      }
    }

    try {
      const media = await uploadBuffer(prisma, entry.buffer, entry.fileName, targetFolderId);
      results.push({ path: entry.relativePath, media });
    } catch (err: unknown) {
      results.push({ path: entry.relativePath, error: err instanceof Error ? err.message : "Upload failed" });
    }
  }

  return { foldersCreated: foldersCreatedSet.size, results };
}

// ---------------------------------------------------------------------------
// List media
// ---------------------------------------------------------------------------

export async function listMedia(
  prisma: PrismaClient,
  query: {
    page?: number;
    limit?: number;
    fileType?: string;
    search?: string;
    folderId?: string | null;
    /** When true, include media at all depths below folderId (not just direct children). */
    recursive?: boolean;
  }
) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 50));
  const skip = (page - 1) * limit;

  const where: Prisma.MediaWhereInput = {};

  if (query.fileType && ["IMAGE", "VIDEO", "AUDIO", "TEXT", "JSON"].includes(query.fileType)) {
    where.fileType = query.fileType as MediaType;
  }
  if (query.search) {
    where.fileName = { contains: query.search, mode: "insensitive" };
  }

  // folderId: undefined = no filter (all media), null = root only, string = specific folder
  if (query.folderId !== undefined) {
    if (query.recursive && query.folderId !== null) {
      // Collect all folder IDs in subtree
      const subtreeIds: string[] = [query.folderId];
      const queue = [query.folderId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        const children = await prisma.mediaFolder.findMany({
          where: { parentId: current },
          select: { id: true },
        });
        for (const child of children) {
          subtreeIds.push(child.id);
          queue.push(child.id);
        }
      }
      where.folderId = { in: subtreeIds };
    } else {
      where.folderId = query.folderId ?? null;
    }
  }

  const [items, total] = await Promise.all([
    prisma.media.findMany({ where, skip, take: limit, orderBy: { uploadedAt: "desc" } }),
    prisma.media.count({ where }),
  ]);

  return { items, total, page, limit };
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteMedia(prisma: PrismaClient, id: string) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) {
    throw Object.assign(new Error("Media not found"), { statusCode: 404 });
  }

  // Safety: reject deletion if referenced by any question or option
  const [questionRef, optionRef] = await Promise.all([
    prisma.question.findFirst({ where: { mediaId: id }, select: { id: true } }),
    prisma.questionOption.findFirst({ where: { mediaId: id }, select: { id: true } }),
  ]);
  if (questionRef || optionRef) {
    throw Object.assign(
      new Error(
        "This media is used by one or more test questions or options and cannot be deleted. " +
          "Remove it from all questions first."
      ),
      { statusCode: 409 }
    );
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

// ---------------------------------------------------------------------------
// Move media to a different folder
// ---------------------------------------------------------------------------

export async function moveMedia(
  prisma: PrismaClient,
  id: string,
  targetFolderId: string | null,
) {
  const media = await prisma.media.findUnique({ where: { id }, select: { id: true, fileName: true } });
  if (!media) {
    throw Object.assign(new Error("Media not found"), { statusCode: 404 });
  }
  if (targetFolderId) {
    const folder = await prisma.mediaFolder.findUnique({ where: { id: targetFolderId }, select: { id: true } });
    if (!folder) {
      throw Object.assign(new Error("Target folder not found"), { statusCode: 404 });
    }
  }

  // Resolve name collision in target folder
  const resolvedName = await resolveFileName(prisma, media.fileName, targetFolderId);

  return prisma.media.update({
    where: { id },
    data: { folderId: targetFolderId, fileName: resolvedName },
  });
}

// ---------------------------------------------------------------------------
// Serve
// ---------------------------------------------------------------------------

export async function serveMedia(prisma: PrismaClient, id: string, reply: FastifyReply) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) {
    return reply.status(404).send({ error: "NOT_FOUND", message: "Media not found" });
  }

  // TEXT / JSON: return the stored textContent directly (no disk read needed)
  if (media.fileType === "TEXT" || media.fileType === "JSON") {
    const ct = media.fileType === "JSON" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8";
    reply.header("Content-Type", ct);
    reply.header("Cache-Control", "public, max-age=86400");
    reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(media.fileName)}"`);
    return reply.send(media.textContent ?? "");
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

  // GOOGLE_DRIVE
  reply.header("Content-Type", media.mimeType);
  reply.header("Cache-Control", "public, max-age=86400");
  return driveService.streamFile(media as Parameters<typeof driveService.streamFile>[0], reply);
}
