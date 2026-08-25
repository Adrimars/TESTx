import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "testx.accessToken";
const REFRESH_TOKEN_KEY = "testx.refreshToken";

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

/**
 * SecureStore throws rather than returning null when the platform has no
 * keystore (web) or the keychain is unavailable. A read failure has to look
 * like "signed out" instead of rejecting, or the launch splash would hang.
 */
async function readKey(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

/**
 * A write failure must not surface as a failed sign-in: the credentials were
 * accepted and the session is live in memory. The cost is that the session does
 * not survive a restart, which is a better outcome than telling someone with
 * valid credentials that their sign-in failed.
 */
export async function saveTokens({ accessToken, refreshToken }: TokenPair): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken).catch(() => undefined),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken).catch(() => undefined),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return readKey(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return readKey(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => undefined),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined),
  ]);
}
