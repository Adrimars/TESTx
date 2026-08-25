/**
 * The mobile design system (prd.md §16.2/§16.3): color tokens, the shared type scale, and
 * spacing. Dark-only in v1 (§16.7) - no light-theme variants to switch between.
 */
export const theme = {
  colors: {
    surfaceBase: "#0B0B0E",
    surfaceRaised: "#17171C",
    /** Popups and target pills at rest (§16.6) - one step lighter than a card. */
    surfaceOverlay: "#1F1F26",
    borderHairline: "#2A2A31",
    textPrimary: "#F5F5F7",
    textSecondary: "#9B9BA6",
    accent: "#FF5A36",
    /** Text/icons drawn on top of `accent`. */
    accentContrast: "#0B0B0E",
    /** Right-swipe / "include" confirmation - its own hue, not `accent`, so swipe
     * direction never depends on remembering which color means "good". */
    success: "#33C481",
    /** Left-swipe / "skip" confirmation. */
    danger: "#FF4D6A",
  },
  /** Echoes the web app's type scale (packages/config/tailwind/preset.ts) despite the
   * different fonts, so both identities share a rhythm. */
  type: {
    prompt: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
    sectionLabel: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
    body: { fontSize: 15, lineHeight: 22, fontWeight: "500" },
    meta: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "600",
      letterSpacing: 0.48,
      textTransform: "uppercase",
    },
    stat: { fontSize: 28, lineHeight: 32, fontWeight: "700" },
  },
  spacing: (n: number) => n * 8,
  /**
   * A token's `#rrggbb` at a given alpha, for translucent fills/scrims - so a highlight or
   * backdrop stays derived from the token system instead of a hand-picked rgba() literal
   * that silently goes stale the next time the token it was copied from changes.
   */
  withAlpha(hex: string, alpha: number): string {
    const value = hex.replace("#", "");
    const r = parseInt(value.substring(0, 2), 16);
    const g = parseInt(value.substring(2, 4), 16);
    const b = parseInt(value.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  },
} as const;
