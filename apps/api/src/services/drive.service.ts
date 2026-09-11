import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { google } from "googleapis";
import type { FastifyReply } from "fastify";
import type { PrismaClient, Prisma } from "@testx/database";
import type { FileMediaType } from "@testx/shared";
import { getCacheDir } from "../lib/media-paths";

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

type Claim =
  | { role: "leader"; task: Promise<void>; resolveTask: () => void; rejectTask: (err: unknown) => void }
  | { role: "follower"; task: Promise<void> };

/**
 * Checks for and, if none exists, registers an in-flight cache-write task for `mediaId`
 * — all in one synchronous stretch with no `await` in between, so two requests arriving
 * back-to-back can't both see no in-flight task and both become leaders. Shared by
 * `streamFile` (the leader also gets a live pipe of its own) and `ensureCachedFile` (no
 * live reply to feed, just the cache write) so both entry points serialize on the same
 * map instead of racing each other.
 */
function claimCacheWrite(mediaId: string): Claim {
  const existing = inFlightCacheWrites.get(mediaId);
  if (existing) return { role: "follower", task: existing };

  let resolveTask!: () => void;
  let rejectTask!: (err: unknown) => void;
  const task = new Promise<void>((resolve, reject) => {
    resolveTask = resolve;
    rejectTask = reject;
  });
  inFlightCacheWrites.set(mediaId, task);
  void task.then(
    () => inFlightCacheWrites.delete(mediaId),
    () => inFlightCacheWrites.delete(mediaId)
  );
  return { role: "leader", task, resolveTask, rejectTask };
}

function originalCachePath(media: Media): string {
  const ext = MIME_TO_EXT[media.mimeType] ?? "bin";
  return path.join(getCacheDir(), `${media.id}.${ext}`);
}

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

      const id = randomUUID();
      const media = await prisma.media.create({
        data: {
          id,
          fileName: file.name,
          fileType,
          mimeType: file.mimeType,
          fileSize: file.size,
          sourceType: "GOOGLE_DRIVE",
          sourceUrl: file.id,
          thumbnailUrl: fileType === "IMAGE" ? `/media/${id}/thumbnail` : null,
          tags: [],
        },
      });

      created.push(media);
    }

    return { count: created.length, items: created };
  },

  /**
   * Guarantees `media`'s original Drive file is on disk at its cache path and returns
   * that path — without streaming anything to a reply. Used by the thumbnail pipeline
   * (17.6), which needs real bytes to resize, not a live response to feed. Shares
   * `claimCacheWrite`'s map with `streamFile`, so a thumbnail request and a direct file
   * request for the same cold `media.id` still only trigger one Drive fetch between them.
   */
  async ensureCachedFile(media: Media): Promise<string> {
    const cacheDir = getCacheDir();
    await fsPromises.mkdir(cacheDir, { recursive: true });
    const cachePath = originalCachePath(media);

    try {
      await fsPromises.access(cachePath);
      return cachePath;
    } catch {
      // cache miss — fetch from Drive
    }

    const claim = claimCacheWrite(media.id);
    if (claim.role === "follower") {
      await claim.task;
      return cachePath;
    }

    try {
      const driveStream = await getDriveReadStream(media);
      await cacheDriveStream(driveStream, cachePath);
      claim.resolveTask();
    } catch (err) {
      claim.rejectTask(err);
      throw err;
    }
    return cachePath;
  },

  async streamFile(media: Media, reply: FastifyReply) {
    const cacheDir = getCacheDir();
    await fsPromises.mkdir(cacheDir, { recursive: true });
    const cachePath = originalCachePath(media);

    reply.header("Content-Type", media.mimeType);
    reply.header("Cache-Control", "public, max-age=86400");

    // Serve from cache on hit
    try {
      await fsPromises.access(cachePath);
      return reply.send(Readable.toWeb(fs.createReadStream(cachePath)));
    } catch {
      // cache miss — fetch from Drive
    }

    const claim = claimCacheWrite(media.id);

    // Follower: another request for this same file is already downloading it. Wait for
    // that shared task instead of starting a second Drive fetch, then serve the file it
    // produced — no live stream of our own to offer, but no duplicate work either.
    if (claim.role === "follower") {
      try {
        await claim.task;
      } catch {
        return reply.status(502).send({ error: "DRIVE_ERROR", message: "Failed to fetch file from Google Drive" });
      }
      return reply.send(Readable.toWeb(fs.createReadStream(cachePath)));
    }

    // Leader: do the actual async work. A failure here — before any bytes are sent —
    // still gets a clean 502 instead of a half-open stream.
    let driveStream: NodeJS.ReadableStream;
    try {
      driveStream = await getDriveReadStream(media);
    } catch (err) {
      claim.rejectTask(err);
      return reply.status(502).send({ error: "DRIVE_ERROR", message: "Failed to fetch file from Google Drive" });
    }

    const passThrough = new PassThrough();
    driveStream.pipe(passThrough);

    cacheDriveStream(driveStream, cachePath).then(claim.resolveTask, (err) => {
      claim.rejectTask(err);
      // The cache write failed (e.g. disk full) or the Drive stream itself dropped
      // mid-transfer — either way this reply's live stream can't continue either.
      if (!passThrough.destroyed) passThrough.destroy(err instanceof Error ? err : new Error(String(err)));
    });

    // Scoped to this reply only: if this client disconnects, stop feeding its own
    // passThrough. The shared task above is untouched, so followers (and
    // `ensureCachedFile` callers) already waiting on it still get a complete,
    // correctly-cached file.
    reply.raw.on("close", () => {
      if (!reply.raw.writableEnded && !passThrough.destroyed) passThrough.destroy();
    });

    return reply.send(Readable.toWeb(passThrough));
  },
};
