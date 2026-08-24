import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { API_URL } from "./env";

WebBrowser.maybeCompleteAuthSession();

export type GoogleAuthResult =
  | { type: "success"; code: string }
  | { type: "cancelled" }
  | { type: "error"; message: string };

/**
 * Opens the existing web OAuth flow in an in-app browser. The API redirects
 * back to testx://auth with a one-time code (never the tokens themselves),
 * which the caller exchanges via /auth/google/exchange.
 */
export async function startGoogleSignIn(): Promise<GoogleAuthResult> {
  const redirectUrl = Linking.createURL("auth");

  const result = await WebBrowser.openAuthSessionAsync(
    `${API_URL}/auth/google?platform=mobile`,
    redirectUrl
  );

  if (result.type === "cancel" || result.type === "dismiss") {
    return { type: "cancelled" };
  }
  if (result.type !== "success") {
    return { type: "error", message: "Google sign-in did not complete" };
  }

  const code = Linking.parse(result.url).queryParams?.code;
  if (typeof code !== "string" || !code) {
    return { type: "error", message: "Google sign-in returned no code" };
  }

  return { type: "success", code };
}
