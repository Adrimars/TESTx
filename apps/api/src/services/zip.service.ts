/**
 * ZIP extraction service.
 *
 * Security model:
 *  - Rejects zip-slip paths (any segment that is ".." or starts with "/").
 *  - Max 1 000 entries total.
 *  - Max 500 MB total uncompressed size.
 *  - Nested .zip entries are skipped (not recursed).
 *  - Only entries whose MIME types are on the shared allowlist are stored; others are skipped.
 *  - Hidden / system files (dot-files, __MACOSX) are skipped.
 *  - Validates and extracts textContent for text/plain entries.
 */
import path from "node:path";
import unzipper from "unzipper";
import type { PrismaClient } from "@testx/database";
import { uploadBuffer } from "./media.service";
import { ensureFolderPath } from "./folder.service";

const MAX_ENTRIES = 1_000;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;

/** Segments that indicate a traversal attack. */
function isSafeRelativePath(rel: string): boolean {
  if (path.isAbsolute(rel)) return false;
  const parts = rel.split(/[\\/]/);
  for (const part of parts) {
    if (part === "..") return false;
    if (part === ".") continue;
    // skip hidden/system files
    if (part.startsWith(".")) return false;
    if (part === "__MACOSX") return false;
  }
  return true;
}

export type ZipResult = {
  foldersCreated: number;
  results: Array<{ path: string; media?: unknown; error?: string }>;
};

export async function extractZip(
  prisma: PrismaClient,
  zipBuffer: Buffer,
  rootFolderId: string | null = null,
): Promise<ZipResult> {
  const results: ZipResult["results"] = [];
  let totalBytes = 0;
  let entryCount = 0;
  const foldersCreatedSet = new Set<string>();

  const directory = await unzipper.Open.buffer(zipBuffer);

  for (const entry of directory.files) {
    // Skip directories (they'll be auto-created when we see files inside them)
    if (entry.type === "Directory") continue;

    entryCount++;
    if (entryCount > MAX_ENTRIES) {
      results.push({ path: entry.path, error: `ZIP exceeds maximum of ${MAX_ENTRIES} entries.` });
      break;
    }

    if (!isSafeRelativePath(entry.path)) {
      results.push({ path: entry.path, error: "Rejected: unsafe path (traversal or hidden file)." });
      continue;
    }

    // Skip nested zip files
    if (entry.path.toLowerCase().endsWith(".zip")) {
      results.push({ path: entry.path, error: "Skipped: nested ZIP files are not extracted." });
      continue;
    }

    // Skip macOS metadata
    if (entry.path.includes("__MACOSX/") || entry.path.startsWith("__MACOSX")) {
      continue;
    }

    // Build folder path from directory segments
    const segments = entry.path.split(/[\\/]/);
    const fileName = segments.pop()!;
    if (!fileName) continue;

    // Track uncompressed size
    const uncompressedSize = entry.uncompressedSize ?? 0;
    totalBytes += uncompressedSize;
    if (totalBytes > MAX_TOTAL_BYTES) {
      results.push({
        path: entry.path,
        error: `ZIP total uncompressed size exceeds ${Math.round(MAX_TOTAL_BYTES / 1024 / 1024)} MB.`,
      });
      break;
    }

    // Read the entry into a buffer
    let buf: Buffer;
    try {
      buf = await entry.buffer();
    } catch {
      results.push({ path: entry.path, error: "Failed to read entry from ZIP." });
      continue;
    }

    // Resolve / create folder path
    let targetFolderId: string | null = rootFolderId;
    if (segments.length > 0) {
      try {
        targetFolderId = await ensureFolderPath(prisma, segments, rootFolderId);
        if (targetFolderId) foldersCreatedSet.add(targetFolderId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create folder path";
        results.push({ path: entry.path, error: msg });
        continue;
      }
    }

    // Upload via shared pipeline (validates MIME, size, extracts textContent)
    try {
      const media = await uploadBuffer(prisma, buf, fileName, targetFolderId);
      results.push({ path: entry.path, media });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      results.push({ path: entry.path, error: msg });
    }
  }

  return { foldersCreated: foldersCreatedSet.size, results };
}
