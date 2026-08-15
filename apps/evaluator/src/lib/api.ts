const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function resolveMediaUrl(relativeUrl: string | null | undefined): string | null {
  if (!relativeUrl) return null;
  if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) return relativeUrl;
  return `${API_URL}${relativeUrl}`;
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
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `API request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
