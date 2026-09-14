import type { FastifyPluginAsync } from "fastify";
import { authenticateUser } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import {
  uploadFile,
  uploadBuffer,
  pasteText,
  folderUpload,
  listMedia,
  deleteMedia,
  moveMedia,
} from "../../services/media.service";
import {
  listFolders,
  listAllFolders,
  getFolderPath,
  createFolder,
  renameFolder,
  moveFolder,
  deleteFolder,
} from "../../services/folder.service";
import { extractZip } from "../../services/zip.service";
import { driveService } from "../../services/drive.service";

const adminAuth = { preHandler: [authenticateUser, requireRole("ADMIN")] };

// ---------------------------------------------------------------------------
// Serializer (adds URL field)
// ---------------------------------------------------------------------------

function serializeMedia(media: { id: string; fileType: string; textContent?: string | null; [key: string]: unknown }) {
  return {
    ...media,
    url: media.fileType !== "TEXT" ? `/media/${media.id}/file` : undefined,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const adminMediaRoutes: FastifyPluginAsync = async (app) => {

  // ── Folder tree ─────────────────────────────────────────────────────────

  /** GET /admin/media/folders?parentId=&all=true */
  app.get("/media/folders", adminAuth, async (request, reply) => {
    const { parentId, all } = request.query as { parentId?: string; all?: string };
    if (all === "true") {
      const folders = await listAllFolders(app.prisma);
      return reply.send({ items: folders });
    }
    const folders = await listFolders(app.prisma, parentId ?? null);
    return reply.send({ items: folders });
  });

  /** GET /admin/media/folders/:id/path — breadcrumb ancestors */
  app.get<{ Params: { id: string } }>("/media/folders/:id/path", adminAuth, async (request, reply) => {
    const crumbs = await getFolderPath(app.prisma, request.params.id);
    return reply.send({ path: crumbs });
  });

  /** POST /admin/media/folders — create folder */
  app.post("/media/folders", adminAuth, async (request, reply) => {
    const { name, parentId } = request.body as { name?: string; parentId?: string | null };
    if (!name || typeof name !== "string") {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "name is required" });
    }
    try {
      const folder = await createFolder(app.prisma, name, parentId ?? null);
      return reply.status(201).send(folder);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return reply.status(e.statusCode ?? 500).send({ error: "ERROR", message: e.message ?? "Failed" });
    }
  });

  /** PUT /admin/media/folders/:id — rename or move */
  app.put<{ Params: { id: string } }>("/media/folders/:id", adminAuth, async (request, reply) => {
    const { id } = request.params;
    const body = request.body as { name?: string; parentId?: string | null };
    try {
      let folder: unknown;
      if (body.name !== undefined && body.parentId === undefined) {
        folder = await renameFolder(app.prisma, id, body.name);
      } else if (body.parentId !== undefined && body.name === undefined) {
        folder = await moveFolder(app.prisma, id, body.parentId ?? null);
      } else if (body.name !== undefined && body.parentId !== undefined) {
        // rename + move: rename first, then move
        folder = await renameFolder(app.prisma, id, body.name);
        folder = await moveFolder(app.prisma, id, body.parentId ?? null);
      } else {
        return reply.status(400).send({ error: "BAD_REQUEST", message: "Provide name or parentId" });
      }
      return reply.send(folder);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return reply.status(e.statusCode ?? 500).send({ error: "ERROR", message: e.message ?? "Failed" });
    }
  });

  /** DELETE /admin/media/folders/:id?force=true */
  app.delete<{ Params: { id: string } }>("/media/folders/:id", adminAuth, async (request, reply) => {
    const { id } = request.params;
    const { force } = request.query as { force?: string };
    try {
      await deleteFolder(app.prisma, id, force === "true");
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return reply.status(e.statusCode ?? 500).send({ error: "ERROR", message: e.message ?? "Failed" });
    }
  });

  // ── Media list ───────────────────────────────────────────────────────────

  /** GET /admin/media?page=&limit=&fileType=&search=&folderId=&recursive= */
  app.get("/media", adminAuth, async (request, reply) => {
    const { page, limit, fileType, search, folderId, recursive } = request.query as {
      page?: string;
      limit?: string;
      fileType?: string;
      search?: string;
      folderId?: string;
      recursive?: string;
    };

    const result = await listMedia(app.prisma, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      fileType,
      search,
      folderId: folderId !== undefined ? (folderId || null) : undefined,
      recursive: recursive === "true",
    });

    return reply.send({
      ...result,
      items: result.items.map(serializeMedia),
    });
  });

  // ── Single-file upload ───────────────────────────────────────────────────

  /**
   * POST /admin/media/upload
   * Multipart form. Optional field: folderId (non-file field read from parts).
   */
  app.post("/media/upload", adminAuth, async (request, reply) => {
    const results: Array<{ fileName: string; media?: unknown; error?: string }> = [];
    let folderId: string | null = null;

    try {
      const parts = request.parts();
      let hasFiles = false;

      for await (const part of parts) {
        if (part.type === "field") {
          if (part.fieldname === "folderId" && typeof part.value === "string" && part.value) {
            folderId = part.value;
          }
          continue;
        }
        hasFiles = true;
        try {
          const media = await uploadFile(app.prisma, part, folderId);
          results.push({ fileName: part.filename, media: serializeMedia(media) });
        } catch (err: unknown) {
          part.file.resume();
          results.push({
            fileName: part.filename,
            error: err instanceof Error ? err.message : "Upload failed",
          });
        }
      }

      if (!hasFiles) {
        return reply.status(400).send({ error: "BAD_REQUEST", message: "No files provided" });
      }
    } catch {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "Failed to parse multipart request" });
    }

    return reply.status(201).send({ results });
  });

  // ── Folder upload (walk a directory tree) ────────────────────────────────

  /**
   * POST /admin/media/folder-upload
   * Multipart form where each file field has a `relativePath` metadata header.
   * Optional field: folderId (root folder for the upload).
   *
   * The frontend sends each file as a separate part with its webkitRelativePath
   * in a `path` field immediately before each file part.
   */
  app.post("/media/folder-upload", adminAuth, async (request, reply) => {
    let rootFolderId: string | null = null;
    const entries: Array<{ relativePath: string; buffer: Buffer; fileName: string }> = [];

    try {
      const parts = request.parts();
      let pendingPath: string | null = null;

      for await (const part of parts) {
        if (part.type === "field") {
          if (part.fieldname === "folderId" && part.value) {
            rootFolderId = part.value as string;
          }
          if (part.fieldname === "path" && typeof part.value === "string") {
            pendingPath = part.value;
          }
          continue;
        }

        const relativePath = pendingPath ?? part.filename;
        pendingPath = null;

        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(chunk as Buffer);
        const buf = Buffer.concat(chunks);

        const fileName = relativePath.split(/[\\/]/).pop() ?? part.filename;
        entries.push({ relativePath, buffer: buf, fileName });
      }
    } catch {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "Failed to parse multipart request" });
    }

    if (entries.length === 0) {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "No files provided" });
    }

    const result = await folderUpload(app.prisma, entries, rootFolderId);
    return reply.status(201).send({
      ...result,
      results: result.results.map((r) => ({
        ...r,
        media: r.media ? serializeMedia(r.media as Parameters<typeof serializeMedia>[0]) : undefined,
      })),
    });
  });

  // ── ZIP upload ───────────────────────────────────────────────────────────

  /** POST /admin/media/zip-upload — single .zip file + optional folderId field */
  app.post("/media/zip-upload", adminAuth, async (request, reply) => {
    let rootFolderId: string | null = null;
    let zipBuffer: Buffer | null = null;

    try {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "field") {
          if (part.fieldname === "folderId" && part.value) rootFolderId = part.value as string;
          continue;
        }
        if (!part.filename.toLowerCase().endsWith(".zip")) {
          part.file.resume();
          return reply.status(400).send({ error: "BAD_REQUEST", message: "Only .zip files are accepted." });
        }
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(chunk as Buffer);
        zipBuffer = Buffer.concat(chunks);
      }
    } catch {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "Failed to parse multipart request" });
    }

    if (!zipBuffer) {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "No ZIP file provided." });
    }

    try {
      const result = await extractZip(app.prisma, zipBuffer, rootFolderId);
      return reply.status(201).send({
        ...result,
        results: result.results.map((r) => ({
          ...r,
          media: r.media ? serializeMedia(r.media as Parameters<typeof serializeMedia>[0]) : undefined,
        })),
      });
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return reply.status(e.statusCode ?? 500).send({ error: "ERROR", message: e.message ?? "ZIP extraction failed" });
    }
  });

  // ── Paste text ───────────────────────────────────────────────────────────

  /** POST /admin/media/text — create TEXT media from pasted content */
  app.post("/media/text", adminAuth, async (request, reply) => {
    const { name, content, folderId } = request.body as {
      name?: string;
      content?: string;
      folderId?: string | null;
    };
    if (!name || typeof name !== "string") {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "name is required" });
    }
    if (content === undefined || content === null || typeof content !== "string") {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "content is required" });
    }
    try {
      const media = await pasteText(app.prisma, name, content, folderId ?? null);
      return reply.status(201).send(serializeMedia(media));
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return reply.status(e.statusCode ?? 500).send({ error: "ERROR", message: e.message ?? "Failed" });
    }
  });

  // ── Move media to folder ─────────────────────────────────────────────────

  /** PUT /admin/media/:id/folder — move a media item to a folder (or root) */
  app.put<{ Params: { id: string } }>("/media/:id/folder", adminAuth, async (request, reply) => {
    const { id } = request.params;
    const { folderId } = request.body as { folderId?: string | null };
    try {
      const media = await moveMedia(app.prisma, id, folderId ?? null);
      return reply.send(serializeMedia(media));
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return reply.status(e.statusCode ?? 500).send({ error: "ERROR", message: e.message ?? "Failed" });
    }
  });

  // ── Google Drive import ──────────────────────────────────────────────────

  app.post("/media/import-drive", adminAuth, async (request, reply) => {
    const { folderUrl, folderId } = request.body as { folderUrl?: string; folderId?: string | null };
    if (!folderUrl || typeof folderUrl !== "string") {
      return reply.status(400).send({ error: "BAD_REQUEST", message: "folderUrl is required" });
    }
    try {
      const result = await driveService.importFolder(app.prisma, folderUrl, folderId ?? null);
      return reply.status(201).send(result);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      const status = e.statusCode ?? 500;
      const message = e.message ?? "Import failed";
      if (status === 400) return reply.status(400).send({ error: "BAD_REQUEST", message });
      if (status === 502) return reply.status(502).send({ error: "DRIVE_ERROR", message });
      throw err;
    }
  });

  // ── Single item ──────────────────────────────────────────────────────────

  app.get<{ Params: { id: string } }>("/media/:id", adminAuth, async (request, reply) => {
    const media = await app.prisma.media.findUnique({ where: { id: request.params.id } });
    if (!media) return reply.status(404).send({ error: "NOT_FOUND", message: "Media not found" });
    return reply.send(serializeMedia(media));
  });

  // ── Delete ───────────────────────────────────────────────────────────────

  app.delete<{ Params: { id: string } }>("/media/:id", adminAuth, async (request, reply) => {
    try {
      await deleteMedia(app.prisma, request.params.id);
      return reply.status(204).send();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      return reply.status(e.statusCode ?? 500).send({ error: "ERROR", message: e.message ?? "Failed" });
    }
  });
};
