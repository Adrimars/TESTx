"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@testx/ui";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, setTheme, mounted } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={mounted ? `Switch to ${theme === "dark" ? "light" : "dark"} theme` : "Toggle theme"}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="px-2"
    >
      {mounted && theme === "dark" ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </Button>
  );
}
