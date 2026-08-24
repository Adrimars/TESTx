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

export async function saveTokens({ accessToken, refreshToken }: TokenPair): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
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
