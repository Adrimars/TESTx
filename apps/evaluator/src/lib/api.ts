/**
 * Auth cookies are `SameSite=Lax` (see apps/api/src/lib/cookies.ts) - the browser only
 * sends them back on requests that are same-site with the PAGE's own origin, not just
 * "reachable". A single build-time `NEXT_PUBLIC_API_URL` baked into the bundle breaks
 * this the moment the same dev server is opened from more than one hostname (e.g.
 * localhost on this computer and a LAN IP from a phone, see start-all.ps1): whichever
 * hostname doesn't match the baked-in value gets its cookie silently dropped on every
 * request after the one that sets it, which reads as "successfully registered, then
 * immediately signed back out."
 *
 * So in dev, deliberately resolve per-browser from `window.location.hostname` instead of
 * a single fixed value, unless an explicit override is set (needed in production, where
 * the API legitimately lives on a different real domain than the page).
 */
function resolveApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") return `http://${window.location.hostname}:4000`;
  return "http://localhost:4000";
}

export const API_URL = resolveApiUrl();

export function resolveMediaUrl(relativeUrl: string | null | undefined): string | null {
  if (!relativeUrl) return null;
  if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) return relativeUrl;
  return `${API_URL}${relativeUrl}`;
}

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

let refreshPromise: Promise<void> | null = null;

async function tryRefresh(): Promise<void> {
  await fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" });
}

export async function apiFetch<T>(path: string, init?: RequestInit, _retry = true): Promise<T> {
  const hasBody = init?.body != null;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  // Auto-refresh expired access token, then retry once
  if (response.status === 401 && _retry) {
    if (!refreshPromise) {
      refreshPromise = tryRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    await refreshPromise;
    return apiFetch<T>(path, init, false);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new ApiError(response.status, body?.error, body?.message ?? `API request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
