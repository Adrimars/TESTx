"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const THEME_COOKIE = "testx-theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** False until the client has taken over from the server-rendered value, so a
   * consumer that depends on OS preference (unknown during SSR) can render a
   * neutral placeholder instead of guessing and mismatching on hydration. */
  mounted: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme | null;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme ?? "dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // No stored cookie: the CSS already followed the OS via prefers-color-scheme
    // with zero flash, so this only syncs the toggle's own displayed state to match.
    if (!initialTheme) {
      const osTheme: Theme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      setThemeState(osTheme);
    }
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    applyTheme(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
