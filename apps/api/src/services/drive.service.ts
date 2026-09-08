import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { google } from "googleapis";
import type { FastifyReply } from "fastify";
import type { PrismaClient, Prisma } from "@testx/database";
import type { FileMediaType } from "@testx/shared";
import { getCacheDir } from "./media.service";

type Media = Prisma.MediaGetPayload<Record<string, never>>;

const SUPPORTED_MIME_TYPES: Record<string, FileMediaType> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "image/gif": "IMAGE",
  "video/mp4": "VIDEO",
  "video/webm": "VIDEO",
  "video/quicktime": "VIDEO",
  "audio/mpeg": "AUDIO",
  "audio/wav": "AUDIO",
  "audio/ogg": "AUDIO",
  "audio/aac": "AUDIO",
};

const MIME_TO_EXT: Record<string, string> = {
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

function getDrive() {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("GOOGLE_DRIVE_API_KEY is not configured"), { statusCode: 502 });
  }
  return google.drive({ version: "v3", auth: apiKey });
}

/**
 * Keyed by `media.id`. On a cold cache, every concurrent requester for the same file
 * would otherwise independently call the Drive API and write to the same temp path,
 * racing each other and risking a corrupted cache file for everyone who reads it after.
 * The first ("leader") request registers its fetch-and-cache task here; later
 * ("follower") requests for the same id await the same task instead of starting their
 * own. Deliberately per-process — the same race is possible across processes once the
 * API scales horizontally, which needs a distributed lock and is out of scope here.
 */
const inFlightCacheWrites = new Map<string, Promise<void>>();

/** Starts the Drive download. Throws synchronously (before any bytes are sent) on failure. */
async function getDriveReadStream(media: Media): Promise<NodeJS.ReadableStream> {
  const drive = getDrive();
  try {
    const driveResponse = await drive.files.get(
      { fileId: media.sourceUrl!, alt: "media" },
      { responseType: "stream" }
    );
    return driveResponse.data as NodeJS.ReadableStream;
  } catch (err) {
    throw Object.assign(new Error("Failed to fetch file from Google Drive"), { statusCode: 502, cause: err });
  }
}

/**
 * Drains `driveStream` into `cachePath`, writing to a per-attempt unique temp path so a
 * failed or overlapping attempt can never clobber a previously-good cache file, and only
 * renaming into place once the download completes successfully.
 */
async function cacheDriveStream(driveStream: NodeJS.ReadableStream, cachePath: string): Promise<void> {
  const tempPath = `${cachePath}.${randomUUID()}.tmp`;
  const cacheWriteStream = fs.createWriteStream(tempPath);

  try {
    await new Promise<void>((resolve, reject) => {
      driveStream.on("error", reject);
      cacheWriteStream.on("error", reject);
      cacheWriteStream.on("finish", resolve);
      driveStream.pipe(cacheWriteStream);
    });
    await fsPromises.rename(tempPath, cachePath);
  } catch (err) {
    if (!cacheWriteStream.destroyed) cacheWriteStream.destroy();
    await fsPromises.unlink(tempPath).catch(() => {});
    throw err;
  }
}

export const driveService = {
  parseFolderId(url: string): string {
    const patterns = [
      /\/drive\/folders\/([a-zA-Z0-9_-]+)/,
      /\/drive\/u\/\d+\/folders\/([a-zA-Z0-9_-]+)/,
      /id=([a-zA-Z0-9_-]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match?.[1]) return match[1];
    }
    throw Object.assign(
      new Error("Invalid Google Drive folder URL. Expected a URL containing /drive/folders/{id}"),
      { statusCode: 400 }
    );
  },

  async listFolderFiles(folderId: string) {
    const drive = getDrive();
    const mimeFilter = Object.keys(SUPPORTED_MIME_TYPES)
      .map((m) => `mimeType = '${m}'`)
      .join(" or ");

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (${mimeFilter})`,
      fields: "files(id, name, mimeType, size)",
      pageSize: 1000,
    });

    return (response.data.files ?? []).map((f) => ({
      id: f.id!,
      name: f.name ?? "untitled",
      mimeType: f.mimeType!,
      size: Number(f.size ?? 0),
    }));
  },

  async importFolder(prisma: PrismaClient, folderUrl: string) {
    const folderId = driveService.parseFolderId(folderUrl);
    const files = await driveService.listFolderFiles(folderId);

    const created: Media[] = [];

    for (const file of files) {
      const fileType = SUPPORTED_MIME_TYPES[file.mimeType];
      if (!fileType) continue;

      // Skip duplicates (same Drive file ID already imported)
      const existing = await prisma.media.findFirst({ where: { sourceUrl: file.id } });
      if (existing) continue;

      const media = await prisma.media.create({
        data: {
          fileName: file.name,
          fileType,
          mimeType: file.mimeType,
          fileSize: file.size,
          sourceType: "GOOGLE_DRIVE",
          sourceUrl: file.id,
          thumbnailUrl: null,
          tags: [],
        },
      });

      created.push(media);
    }

    return { count: created.length, items: created };
  },

  async streamFile(media: Media, reply: FastifyReply) {
    const cacheDir = getCacheDir();
    await fsPromises.mkdir(cacheDir, { recursive: true });

    const ext = MIME_TO_EXT[media.mimeType] ?? "bin";
    const cachePath = path.join(cacheDir, `${media.id}.${ext}`);

    reply.header("Content-Type", media.mimeType);
    reply.header("Cache-Control", "public, max-age=86400");

    // Serve from cache on hit
    try {
      await fsPromises.access(cachePath);
      return reply.send(Readable.toWeb(fs.createReadStream(cachePath)));
    } catch {
      // cache miss — fetch from Drive
    }

    // Follower: another request for this same file is already downloading it. Wait for
    // that shared task instead of starting a second Drive fetch, then serve the file it
    // produced — no live stream of our own to offer, but no duplicate work either.
    const existing = inFlightCacheWrites.get(media.id);
    if (existing) {
      try {
        await existing;
      } catch {
        return reply.status(502).send({ error: "DRIVE_ERROR", message: "Failed to fetch file from Google Drive" });
      }
      return reply.send(Readable.toWeb(fs.createReadStream(cachePath)));
    }

    // Leader: claim the in-flight slot with a placeholder promise *before* any `await`,
    // in the same synchronous stretch as the `existing` check above — otherwise two
    // requests arriving back-to-back could both see no in-flight task and both become
    // leaders, recreating the exact race this map exists to prevent.
    let resolveTask!: () => void;
    let rejectTask!: (err: unknown) => void;
    const task = new Promise<void>((resolve, reject) => {
      resolveTask = resolve;
      rejectTask = reject;
    });
    inFlightCacheWrites.set(media.id, task);
    void task.then(
      () => inFlightCacheWrites.delete(media.id),
      () => inFlightCacheWrites.delete(media.id)
    );

    // Now do the actual async work. A failure here — before any bytes are sent — still
    // gets a clean 502 instead of a half-open stream.
    let driveStream: NodeJS.ReadableStream;
    try {
      driveStream = await getDriveReadStream(media);
    } catch (err) {
      rejectTask(err);
      return reply.status(502).send({ error: "DRIVE_ERROR", message: "Failed to fetch file from Google Drive" });
    }

    const passThrough = new PassThrough();
    driveStream.pipe(passThrough);

    cacheDriveStream(driveStream, cachePath).then(resolveTask, (err) => {
      rejectTask(err);
      // The cache write failed (e.g. disk full) or the Drive stream itself dropped
      // mid-transfer — either way this reply's live stream can't continue either.
      if (!passThrough.destroyed) passThrough.destroy(err instanceof Error ? err : new Error(String(err)));
    });

    // Scoped to this reply only: if this client disconnects, stop feeding its own
    // passThrough. The shared `task` above is untouched, so followers already waiting
    // on it still get a complete, correctly-cached file.
    reply.raw.on("close", () => {
      if (!reply.raw.writableEnded && !passThrough.destroyed) passThrough.destroy();
    });

    return reply.send(Readable.toWeb(passThrough));
  },
};
