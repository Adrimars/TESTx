/// <reference lib="webworker" />
import { NetworkFirst, Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare const self: ServiceWorkerGlobalScope &
  SerwistGlobalConfig & {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  };

/**
 * Mobile-web's PWA service worker (18.5). The app shell (JS/CSS/HTML/icons) is precached
 * from the manifest `@serwist/cli`'s `build` command injects at export time - see
 * package.json's `build:web` script - so the shell still opens offline. Everything else
 * falls through to `runtimeCaching` below: API calls must never come from a stale cache
 * (a stale test deck or a stale balance is actively wrong, not just outdated), so they are
 * network-first with only a short timeout-driven cache fallback, not the default handler
 * an unmatched request would otherwise get.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      // Requests to apps/api - a different origin/port in every environment this app
      // runs in - are never part of the precached app shell.
      matcher: ({ sameOrigin }) => !sameOrigin,
      handler: new NetworkFirst({
        cacheName: "testx-api",
        networkTimeoutSeconds: 10,
      }),
    },
  ],
});

serwist.addEventListeners();
