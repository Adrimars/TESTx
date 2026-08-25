import * as Application from "expo-application";
import { API_URL } from "./env";

export { isVersionBelow } from "./version";

export type MinVersionInfo = {
  minVersion: string;
  storeUrls: { ios: string | null; android: string | null };
};

/**
 * Null when the platform cannot report a version - notably Expo's web target, which has
 * no native bundle to read one from. Deliberately not defaulted to "0.0.0": that would
 * turn "the version is unknown" into "the version is older than every minimum", locking
 * the app behind the update wall on exactly the platforms the store gate does not target.
 */
export const currentAppVersion: string | null = Application.nativeApplicationVersion;

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
