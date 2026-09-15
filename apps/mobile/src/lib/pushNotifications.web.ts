import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "./api";

/** Mirrors pushNotifications.native.ts's per-account-per-device "don't nag" key. */
const ASKED_KEY_PREFIX = "testx.pushPermissionAsked";

function askedKey(userId: string): string {
  return `${ASKED_KEY_PREFIX}.${userId}`;
}

async function hasAskedBefore(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(askedKey(userId))) === "1";
  } catch {
    return false;
  }
}

async function markAsked(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(askedKey(userId), "1");
  } catch {
    // Best-effort - worst case this account is asked again next launch.
  }
}

function isPushApiSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    // iOS Safari has never adopted the standard media query - this is its own flag.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) && /WebKit/.test(ua) && !/CriOS|FxiOS/.test(ua);
}

/** RFC 4648 base64url, as `PushManager.subscribe`'s `applicationServerKey` requires -
 * `atob`/`btoa` only handle the standard alphabet, hence the substitutions below. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

/**
 * Requests browser notification permission and subscribes via the service worker
 * registered for the PWA (Phase 18.5's sw-src.ts). iOS Safari web push only works for an
 * installed (Home Screen) PWA and needs its own explicit permission prompt post-install
 * (21.4) - skipped entirely everywhere else on iOS Safari rather than showing a prompt
 * that could never deliver anything.
 *
 * Never throws - called from a background effect, where a failure (unsupported browser,
 * no VAPID key configured server-side, a rejected permission prompt) must never surface
 * as an app error.
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<void> {
  if (!isPushApiSupported()) return;
  if (isIOSSafari() && !isStandalonePwa()) return;

  try {
    let permission = Notification.permission;
    if (permission === "default") {
      if (await hasAskedBefore(userId)) return;
      permission = await Notification.requestPermission();
      await markAsked(userId);
    }
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const { publicKey } = await apiFetch<{ publicKey: string | null }>("/users/push-vapid-key");
      if (!publicKey) return; // Server has no VAPID key configured yet.
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // lib.dom's PushSubscriptionOptionsInit wants an ArrayBuffer-backed view;
        // Uint8Array's own type is ArrayBufferLike-backed (which also covers
        // SharedArrayBuffer), so TS needs the cast even though this one is always a plain
        // ArrayBuffer at runtime.
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
    }

    await apiFetch("/users/me/push-subscription", {
      method: "POST",
      body: JSON.stringify({ platform: "WEB", token: JSON.stringify(subscription) }),
    });
  } catch (error) {
    console.warn("push registration failed", error);
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!isPushApiSupported()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    const token = JSON.stringify(subscription);
    await subscription.unsubscribe();
    await apiFetch("/users/me/push-subscription", { method: "DELETE", body: JSON.stringify({ token }) });
  } catch (error) {
    console.warn("push unregistration failed", error);
  }
}

export async function isPushPermissionGranted(): Promise<boolean> {
  if (!isPushApiSupported()) return false;
  return Notification.permission === "granted";
}

/** Mirrors pushNotifications.native.ts's deep-link target shape, for type-compatibility
 * with the shared import - web push taps never actually go through this function, since
 * sw-src.ts's `notificationclick` handler navigates with a plain URL string instead (a
 * service worker has no React tree to hand an expo-router Href to). */
export function notificationTarget(
  data: Record<string, unknown> | undefined
): { pathname: "/feed"; params?: { testId: string } } {
  const testId = typeof data?.testId === "string" ? data.testId : undefined;
  return testId ? { pathname: "/feed", params: { testId } } : { pathname: "/feed" };
}

/** Web push taps are handled entirely inside the service worker (sw-src.ts's
 * `notificationclick`, which calls `clients.openWindow` directly) - there is no
 * foreground JS event to listen for here. */
export function addNotificationTapListener(
  _onTap: (data: Record<string, unknown> | undefined) => void
): () => void {
  return () => {};
}
