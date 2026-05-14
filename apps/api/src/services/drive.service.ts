import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";
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
      return reply.send(fs.createReadStream(cachePath));
    } catch {
      // cache miss — fetch from Drive
    }

    const drive = getDrive();
    let driveResponse;
    try {
      driveResponse = await drive.files.get(
        { fileId: media.sourceUrl!, alt: "media" },
        { responseType: "stream" }
      );
    } catch {
      return reply.status(502).send({ error: "DRIVE_ERROR", message: "Failed to fetch file from Google Drive" });
    }

    const tempPath = `${cachePath}.tmp`;
    const cacheWriteStream = fs.createWriteStream(tempPath);
    const passThrough = new PassThrough();

    const driveStream = driveResponse.data as NodeJS.ReadableStream;

    driveStream.on("data", (chunk: Buffer) => {
      cacheWriteStream.write(chunk);
      passThrough.push(chunk);
    });
    driveStream.on("end", () => {
      cacheWriteStream.end();
      passThrough.push(null);
      fs.rename(tempPath, cachePath, () => {});
    });
    driveStream.on("error", () => {
      cacheWriteStream.destroy();
      passThrough.destroy();
      fs.unlink(tempPath, () => {});
    });

    return reply.send(passThrough);
  },
};
