import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "testx.accessToken";
const REFRESH_TOKEN_KEY = "testx.refreshToken";

/**
 * expo-secure-store ships no web implementation - its web module is an empty object - so
 * on web every read and write fails and the session dies the moment it is created. Web is
 * only ever a development surface for this app (the shipped targets are iOS and Android),
 * but it is the surface the swipe engine gets exercised on during development, so it needs
 * to be able to hold a session. localStorage is not secure storage and is deliberately not
 * used anywhere else.
 */
const isWeb = Platform.OS === "web";

function webStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

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
  if (isWeb) return webStorage()?.getItem(key) ?? null;
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
  if (isWeb) {
    webStorage()?.setItem(ACCESS_TOKEN_KEY, accessToken);
    webStorage()?.setItem(REFRESH_TOKEN_KEY, refreshToken);
    return;
  }
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
  if (isWeb) {
    webStorage()?.removeItem(ACCESS_TOKEN_KEY);
    webStorage()?.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => undefined),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined),
  ]);
}
