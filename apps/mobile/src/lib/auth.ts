import { loginSchema, registerSchema, type CurrentUser } from "@testx/shared";
import { apiFetch } from "./api";
import { saveTokens, clearTokens, type TokenPair } from "./tokens";

/** Register/login return the user plus the token pair (see Phase 9.1). */
type AuthResponse = CurrentUser & TokenPair;

export async function login(email: string, password: string): Promise<CurrentUser> {
  const credentials = loginSchema.parse({ email, password });
  const response = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
  await persist(response);
  return response;
}

export async function register(email: string, password: string): Promise<CurrentUser> {
  const credentials = registerSchema.parse({ email, password });
  const response = await apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
  await persist(response);
  return response;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/me");
}

export async function logout(): Promise<void> {
  await clearTokens();
}

async function persist({ accessToken, refreshToken }: AuthResponse): Promise<void> {
  await saveTokens({ accessToken, refreshToken });
}
