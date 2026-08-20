import forms from "@tailwindcss/forms";
import type { Config } from "tailwindcss";

const preset = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          foreground: "hsl(var(--surface-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontSize: {
        // Shared type scale. Page title → section → card title → body → meta.
        "page-title": ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        "section-title": ["1.125rem", { lineHeight: "1.35", fontWeight: "600" }],
        "card-title": ["1rem", { lineHeight: "1.4", fontWeight: "600" }],
        meta: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.06em", fontWeight: "500" }],
        stat: ["1.875rem", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
      },
      ringWidth: {
        DEFAULT: "2px",
      },
    },
  },
  plugins: [forms],
} satisfies Partial<Config>;

export default preset;
