import Constants from "expo-constants";

/**
 * A physical device running Expo Go cannot reach the dev machine's localhost, so
 * fall back to the host that served the JS bundle rather than 127.0.0.1.
 *
 * On web this matters for a second, sharper reason: auth cookies are `SameSite=Lax`
 * (apps/api/src/lib/cookies.ts), so the browser only sends one back on requests that are
 * same-site with the PAGE's own origin. `Constants.expoConfig.hostUri` isn't populated on
 * web, so check `window.location` first - the same dev server reachable as both
 * localhost and a LAN IP (see start-all.ps1) needs each browser talking to the API on
 * whichever hostname it actually used, or the "other" hostname's cookie gets silently
 * dropped after the very first request that sets it.
 */
function inferDevApiUrl(): string {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:4000`;
  }
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  return host ? `http://${host}:4000` : "http://localhost:4000";
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? inferDevApiUrl();

export function resolveMediaUrl(relativeUrl: string | null | undefined): string | null {
  if (!relativeUrl) return null;
  if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) return relativeUrl;
  return `${API_URL}${relativeUrl}`;
}
