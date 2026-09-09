import { API_URL } from "./env";

export type GoogleAuthResult =
  | { type: "success"; code: string }
  | { type: "cancelled" }
  | { type: "error"; message: string };

/**
 * Native opens an in-app browser and gets a one-time code back over a deep link (18.2);
 * a web build has no deep link to return to, so it does a full-page redirect straight
 * into the same `/auth/google` → `/auth/google/callback` flow apps/evaluator already
 * uses. The callback sets the session cookie itself and redirects back into this app, so
 * by the time any JS here would resume, the session already exists - there is no code
 * to exchange. The promise below deliberately never resolves: the navigation below
 * unloads this page before it would need to.
 */
export async function startGoogleSignIn(): Promise<GoogleAuthResult> {
  window.location.href = `${API_URL}/auth/google?platform=mobile-web`;
  return new Promise(() => {});
}
