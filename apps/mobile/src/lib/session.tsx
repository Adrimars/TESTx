import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CurrentUser } from "@testx/shared";
import { apiFetch, setSessionExpiredHandler } from "./api";
import { clearInProgressTest, clearPendingSubmission } from "./submissionQueue";
import { clearTokens, getAccessToken, saveTokens, type TokenPair } from "./tokens";

type AuthResponse = CurrentUser & TokenPair;

export type MobileRegisterPayload = {
  email: string;
  password: string;
  ageConfirmed: true;
  aydinlatmaAcknowledged: true;
  acikRizaAccepted?: boolean;
  deviceId?: string;
};

type SessionValue = {
  user: CurrentUser | null;
  /** True until the stored token has been checked on launch. */
  initializing: boolean;
  hasProfile: boolean;
  /**
   * True when the signed-in user has never been shown the KVKK Article 10 disclosure.
   *
   * Google-registered accounts are the case this was built for - the OAuth callback
   * creates them and cannot show the disclosure - but the condition is deliberately the
   * absence of the stamp, not the presence of a googleId. Any account predating the
   * column is in the same position: it was never shown the text, so it is shown the text.
   * That is a real change for existing users, and the correct one.
   */
  needsAydinlatma: boolean;
  signIn: (email: string, password: string) => Promise<CurrentUser>;
  signUp: (payload: MobileRegisterPayload) => Promise<CurrentUser>;
  signInWithCode: (code: string) => Promise<CurrentUser>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Records the acknowledgment server-side and adopts the updated user. */
  acknowledgeAydinlatma: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const adopt = useCallback(async (response: AuthResponse): Promise<CurrentUser> => {
    await saveTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
    setUser(response);
    return response;
  }, []);

  // A refresh that fails mid-session must drop the user back to the entry
  // screen rather than leave a signed-out app rendering signed-in chrome.
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) setInitializing(false);
        return;
      }
      try {
        const current = await apiFetch<CurrentUser>("/auth/me");
        if (!cancelled) setUser(current);
      } catch {
        // Token was present but unusable; treat it as signed out.
        await clearTokens();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) =>
      adopt(
        await apiFetch<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        })
      ),
    [adopt]
  );

  const signUp = useCallback(
    async (payload: MobileRegisterPayload) =>
      adopt(
        await apiFetch<AuthResponse>("/auth/register/mobile", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      ),
    [adopt]
  );

  const signInWithCode = useCallback(
    async (code: string) =>
      adopt(
        await apiFetch<AuthResponse>("/auth/google/exchange", {
          method: "POST",
          body: JSON.stringify({ code }),
        })
      ),
    [adopt]
  );

  const signOut = useCallback(async () => {
    // Belt-and-suspenders (16.10): per-user storage keys already stop a different
    // account ever reading these, but an abandoned session leaving its own queued
    // in-progress/pending records behind indefinitely is still just clutter worth
    // clearing on the way out.
    if (user) {
      await Promise.all([clearInProgressTest(user.id), clearPendingSubmission(user.id)]);
    }
    await clearTokens();
    setUser(null);
  }, [user]);

  const refreshUser = useCallback(async () => {
    setUser(await apiFetch<CurrentUser>("/auth/me"));
  }, []);

  const acknowledgeAydinlatma = useCallback(async () => {
    setUser(await apiFetch<CurrentUser>("/auth/aydinlatma", { method: "POST" }));
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      initializing,
      hasProfile: user?.evaluatorProfile != null,
      needsAydinlatma: user != null && user.aydinlatmaAcknowledgedAt == null,
      signIn,
      signUp,
      signInWithCode,
      signOut,
      refreshUser,
      acknowledgeAydinlatma,
    }),
    [
      user,
      initializing,
      signIn,
      signUp,
      signInWithCode,
      signOut,
      refreshUser,
      acknowledgeAydinlatma,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside a SessionProvider");
  return context;
}
