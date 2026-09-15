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

/** Where the "Switch to desktop version" link (18.4, web only) goes. In production this
 * is the same domain the mobile-web build itself was reached through - apps/evaluator's
 * proxy.ts is what makes that transparent - so this only needs its own value in dev,
 * where the two apps still run on separate ports. */
export const EVALUATOR_APP_URL = process.env.EXPO_PUBLIC_EVALUATOR_APP_URL ?? "http://localhost:3000";

export function resolveMediaUrl(relativeUrl: string | null | undefined): string | null {
  if (!relativeUrl) return null;
  if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) return relativeUrl;
  return `${API_URL}${relativeUrl}`;
}
