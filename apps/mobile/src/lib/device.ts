import * as Application from "expo-application";
import { Platform } from "react-native";

const WEB_DEVICE_ID_KEY = "testx.webDeviceId";

/**
 * No real hardware identifier exists on web (18.6) - a browser has no vendor id or
 * Android id to read. A random UUID persisted in localStorage is a weaker signal (it
 * resets on a cleared profile or a different browser, where a native id survives a
 * reinstall), but the multi-account check it feeds is already "flag, don't block", so a
 * weaker signal there is an acceptable trade for having one at all.
 */
function getOrCreateWebDeviceId(): string | undefined {
  try {
    const existing = localStorage.getItem(WEB_DEVICE_ID_KEY);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    localStorage.setItem(WEB_DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return undefined;
  }
}

/**
 * Stable per-install device identifier, used only as a multi-account signal at
 * registration. Both values reset if the user uninstalls (iOS: when all apps
 * from the vendor are removed), which is acceptable - this is a detection
 * heuristic, not an identity.
 */
export async function getDeviceId(): Promise<string | undefined> {
  try {
    if (Platform.OS === "android") {
      return Application.getAndroidId() ?? undefined;
    }
    if (Platform.OS === "ios") {
      return (await Application.getIosIdForVendorAsync()) ?? undefined;
    }
    if (Platform.OS === "web") {
      return getOrCreateWebDeviceId();
    }
    return undefined;
  } catch {
    // Never let an unavailable identifier block registration.
    return undefined;
  }
}
