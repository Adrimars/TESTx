"use client";

import type { CurrentUser } from "@testx/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type AuthContextValue = {
  user: CurrentUser | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<CurrentUser>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await apiFetch<CurrentUser>("/auth/me");
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string): Promise<CurrentUser> => {
    const currentUser = await apiFetch<CurrentUser>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(currentUser);
    return currentUser;
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const register = useCallback(async (email: string, password: string): Promise<CurrentUser> => {
    const currentUser = await apiFetch<CurrentUser>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(currentUser);
    return currentUser;
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, refreshUser, login, logout, register }),
    [user, isLoading, refreshUser, login, logout, register]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
