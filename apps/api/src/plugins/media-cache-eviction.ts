import fp from "fastify-plugin";
import { enforceCacheSizeLimit, getCacheDir, getCacheMaxBytes } from "../services/media.service";

const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Periodic size-capped LRU eviction for `cache/media` (Finding 10, plan.md 17.1) — the
 * directory otherwise grows monotonically, since files are only ever removed when their
 * `Media` row is explicitly deleted.
 */
export const mediaCacheEvictionPlugin = fp(async (app) => {
  const dir = getCacheDir();
  const maxBytes = getCacheMaxBytes();

  const sweep = () => {
    enforceCacheSizeLimit(dir, maxBytes).catch((err) => {
      app.log.error({ err }, "media cache eviction sweep failed");
    });
  };

  sweep();
  const timer = setInterval(sweep, SWEEP_INTERVAL_MS);
  timer.unref();

  app.addHook("onClose", () => {
    clearInterval(timer);
  });
});
