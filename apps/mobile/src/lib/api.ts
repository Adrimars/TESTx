import { Platform } from "react-native";
import { API_URL } from "./env";
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "./tokens";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Set by the auth provider so a failed refresh can drop the session. */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

// Concurrent 401s must trigger one refresh, not one per in-flight request.
let refreshPromise: Promise<boolean> | null = null;

/**
 * Web has no local refresh token to send (18.2) - the API reads its own `refresh_token`
 * cookie instead, so an empty body plus `credentials: "include"` is enough. A native
 * client with no stored refresh token has nothing to refresh with, so it skips the
 * network round trip entirely rather than making a request the API would just reject.
 */
async function refreshAccessToken(): Promise<boolean> {
  const isWeb = Platform.OS === "web";
  const refreshToken = await getRefreshToken();
  if (!isWeb && !refreshToken) return false;

  const response = await fetchWithTimeout(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(refreshToken ? { refreshToken } : {}),
  });

  if (!response.ok) return false;

  // The API already rotated the access_token cookie on this response; there is
  // nothing further for a web client to store.
  if (isWeb) return true;

  const body = (await response.json().catch(() => null)) as {
    accessToken?: string;
    refreshToken?: string;
  } | null;

  // The early return above only guarantees this for the isWeb branch already handled;
  // a native client reaching this point always has one, but the check still has to be
  // repeated here for the type narrowing.
  if (!body?.accessToken || !refreshToken) return false;

  await saveTokens({
    accessToken: body.accessToken,
    refreshToken: body.refreshToken ?? refreshToken,
  });
  return true;
}

async function runRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Ceiling on how long any one request may take before it is treated as failed.
 *
 * Nothing else guarantees a request ever settles. A `fetch` against an API that is simply
 * not there (server down, wrong LAN address, dropped wifi) can sit unresolved
 * indefinitely, and every screen gated on `isPending` then spins forever - no error, no
 * retry, no way for the evaluator to tell "still loading" from "never going to load".
 * Generous enough that a slow-but-real response is never cut off; short enough that a
 * dead one becomes a visible, retryable error instead of an eternal spinner.
 */
const REQUEST_TIMEOUT_MS = 15_000;

/** Thrown when a request exceeds REQUEST_TIMEOUT_MS. Status 0 marks it as never having
 * reached the server, so the retry policy treats it as retryable rather than as a 4xx. */
export class TimeoutError extends ApiError {
  constructor() {
    super(0, "TIMEOUT", "The server took too long to respond. Check your connection and try again.");
    this.name = "TimeoutError";
  }
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    // An abort surfaces as a generic AbortError; re-raise it as the timeout it actually
    // was, so the UI can say something truer than "Aborted".
    if (controller.signal.aborted) throw new TimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const accessToken = await getAccessToken();
  const hasBody = init?.body != null;

  const response = await fetchWithTimeout(`${API_URL}${path}`, {
    ...init,
    // Web's session lives in an httpOnly cookie (18.2); this is what makes the browser
    // attach it on every request. RN's own fetch has no cookie jar to act on it, so this
    // is a harmless no-op there rather than something that needs a platform guard.
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 401 && retry) {
    const refreshed = await runRefresh();
    if (refreshed) {
      return apiFetch<T>(path, init, false);
    }
    await clearTokens();
    onSessionExpired?.();
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    throw new ApiError(
      response.status,
      body?.error,
      body?.message ?? `API request failed with ${response.status}`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
