import Constants from "expo-constants";

/**
 * A physical device running Expo Go cannot reach the dev machine's localhost, so
 * fall back to the host that served the JS bundle rather than 127.0.0.1.
 */
function inferDevApiUrl(): string {
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
