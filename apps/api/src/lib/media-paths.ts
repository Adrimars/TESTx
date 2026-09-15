import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Path helpers only — no dependency on `media.service.ts` or `drive.service.ts`, so both
 * of those can depend on this without a circular import (needed once `media.service.ts`
 * calls into `drive.service.ts` to thumbnail Drive-sourced images, see 17.6).
 */

/**
 * Monorepo root. The upload root is anchored here rather than to process.cwd() so the API
 * and the seed script agree on where uploads live no matter which directory they are
 * started from - they previously disagreed, and only stored absolute paths papered over it.
 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

export function getUploadDir(): string {
  const configured = process.env.UPLOAD_DIR ?? "./uploads";
  return path.isAbsolute(configured) ? configured : path.resolve(REPO_ROOT, configured);
}

/**
 * Turns a stored media path into a real one.
 *
 * New rows store a path relative to the upload root, because an absolute path is only
 * true for the machine and the directory that wrote it - moving the project orphaned
 * every upload, with the database still confidently pointing at a folder that no longer
 * existed. Older absolute values are still honoured so existing rows keep working.
 */
export function resolveUploadPath(sourceUrl: string): string {
  return path.isAbsolute(sourceUrl) ? sourceUrl : path.resolve(getUploadDir(), sourceUrl);
}

export function getCacheDir(): string {
  return path.resolve(process.env.CACHE_DIR ?? "./cache/media");
}

export function getCacheMaxBytes(): number {
  const configuredMb = Number(process.env.CACHE_MAX_SIZE_MB);
  const mb = Number.isFinite(configuredMb) && configuredMb > 0 ? configuredMb : 2048;
  return mb * 1024 * 1024;
}

/**
 * Resized image variant's cache path (17.6) — a flat `<id>.thumb.webp` file alongside
 * Drive originals in the same `cache/media` directory, deliberately not a subdirectory,
 * so the existing top-level LRU eviction sweep (17.1) covers thumbnails too without
 * having to recurse.
 */
export function getThumbnailPath(mediaId: string): string {
  return path.join(getCacheDir(), `${mediaId}.thumb.webp`);
}
