/**
 * The web build never stores a token client-side (18.2) - it authenticates with the
 * httpOnly session cookie apps/api sets on login/register/refresh, which JS can neither
 * read nor write. Every read here returns null and every write is a no-op, so `api.ts`'s
 * shared call sites stay platform-agnostic without ever touching localStorage.
 */
export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export async function saveTokens(_tokens: TokenPair): Promise<void> {}

export async function getAccessToken(): Promise<string | null> {
  return null;
}

export async function getRefreshToken(): Promise<string | null> {
  return null;
}

export async function clearTokens(): Promise<void> {}
