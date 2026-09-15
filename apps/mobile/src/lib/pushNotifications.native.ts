import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "./api";

/**
 * 21.3's native push. Foreground notifications still show a banner - without this handler
 * Android silently drops them while the app is open, which would make "does push even
 * work" impossible to tell apart from "nothing was sent" during testing.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Scoped per account per device, same reasoning as submissionQueue.ts's storage keys - a
 * device that gets signed into a different account should be asked again, not silently
 * inherit the previous account's answer. */
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

/**
 * Requests notification permission at most once per account per device - a user who
 * dismisses or denies it is not re-prompted on every launch, matching the platform's own
 * "don't nag" expectation. A user who already granted it is silently re-registered every
 * time this runs, so a rotated Expo token still reaches the API.
 *
 * Never throws: called from a background effect at launch, where a push-registration
 * failure (no EAS project configured yet, a simulator with no push capability, an API
 * hiccup) must never be visible as an app-breaking error.
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<void> {
  if (!Constants.isDevice) return;

  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== "granted") {
      if (await hasAskedBefore(userId)) return;
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
      await markAsked(userId);
      if (status !== "granted") return;
    }

    // Unset until this app is registered with EAS (plan.md 21.3's own prerequisite) - the
    // SDK falls back to Constants.easConfig?.projectId itself when this is undefined.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    await apiFetch("/users/me/push-subscription", {
      method: "POST",
      body: JSON.stringify({ platform: Platform.OS === "ios" ? "IOS" : "ANDROID", token }),
    });
  } catch (error) {
    console.warn("push registration failed", error);
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!Constants.isDevice) return;

  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    await apiFetch("/users/me/push-subscription", { method: "DELETE", body: JSON.stringify({ token }) });
  } catch (error) {
    console.warn("push unregistration failed", error);
  }
}

export async function isPushPermissionGranted(): Promise<boolean> {
  if (!Constants.isDevice) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Deep-links a tapped notification into the feed (21.3's exit criterion), reusing
 * feed.tsx's existing `testId` param rather than adding a second way to open one directly.
 * Falls back to the feed's own "whatever is next" default for a reminder, which carries no
 * specific test. Returned as expo-router's object Href form, which typed routes actually
 * validates - a hand-built query string is not.
 */
export function notificationTarget(
  data: Record<string, unknown> | undefined
): { pathname: "/feed"; params?: { testId: string } } {
  const testId = typeof data?.testId === "string" ? data.testId : undefined;
  return testId ? { pathname: "/feed", params: { testId } } : { pathname: "/feed" };
}

/**
 * Fires `onTap` both for a notification tapped while the app is already running, and for
 * one that cold-launched the app - `addNotificationResponseReceivedListener` only ever
 * catches the former, so a cold start needs `getLastNotificationResponseAsync` to recover
 * the same data the launch itself would otherwise lose.
 */
export function addNotificationTapListener(
  onTap: (data: Record<string, unknown> | undefined) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    onTap(response.notification.request.content.data as Record<string, unknown> | undefined);
  });

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      onTap(response.notification.request.content.data as Record<string, unknown> | undefined);
    }
  });

  return () => subscription.remove();
}
