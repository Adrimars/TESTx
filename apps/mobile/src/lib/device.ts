import * as Application from "expo-application";
import { Platform } from "react-native";

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
    return undefined;
  } catch {
    // Never let an unavailable identifier block registration.
    return undefined;
  }
}
