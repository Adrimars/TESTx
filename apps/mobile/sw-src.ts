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

/**
 * 21.4's Web Push receive/tap handling. Both events have to be handled at this layer -
 * `push` is what actually surfaces a system notification for a message the browser
 * delivered while no tab was open, and `notificationclick` is the only place a service
 * worker can react to a tap on one, since there is no foreground page (and so no React
 * tree) to hand the tap to directly.
 */
type PushPayload = { title: string; body: string; data?: { testId?: string; type?: string } };

self.addEventListener("push", (event: PushEvent) => {
  let payload: PushPayload = { title: "TESTx", body: "You have a new notification." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // A push with a non-JSON (or absent) body still deserves a visible notification
    // rather than being dropped, so this falls through to the generic payload above.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: payload.data,
      // Same PWA icon manifest.webmanifest already declares (18.5), rather than a
      // separate asset that would need its own upkeep.
      icon: "/icons/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  // Mirrors pushNotifications.native.ts's `notificationTarget` - a service worker has no
  // expo-router Href to hand off to, only a real URL to open or focus.
  const testId = (event.notification.data as PushPayload["data"] | undefined)?.testId;
  const targetPath = testId ? `/feed?testId=${testId}` : "/feed";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        return (existing as WindowClient).focus().then((focused) => focused.navigate(targetPath));
      }
      return self.clients.openWindow(targetPath);
    })
  );
});
