/**
 * Placeholder tokens so the scaffold screens are not styled ad hoc. The real
 * design system lands in Phase 12 (prd.md 16.2).
 */
export const theme = {
  colors: {
    surfaceBase: "#0B0B0F",
    surfaceRaised: "#16161D",
    borderHairline: "#2A2A35",
    textPrimary: "#F5F5F7",
    textSecondary: "#9A9AA8",
    accent: "#6C5CE7",
    accentContrast: "#FFFFFF",
    danger: "#E5484D",
  },
  spacing: (n: number) => n * 8,
} as const;
