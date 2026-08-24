import * as Application from "expo-application";
import { API_URL } from "./env";

export { isVersionBelow } from "./version";

export type MinVersionInfo = {
  minVersion: string;
  storeUrls: { ios: string | null; android: string | null };
};

export const currentAppVersion = Application.nativeApplicationVersion ?? "0.0.0";

/**
 * Returns null when the check cannot be made. A network failure must not lock
 * a working app behind the update wall.
 */
export async function fetchMinVersion(): Promise<MinVersionInfo | null> {
  try {
    const response = await fetch(`${API_URL}/mobile/min-version`);
    if (!response.ok) return null;
    return (await response.json()) as MinVersionInfo;
  } catch {
    return null;
  }
}
