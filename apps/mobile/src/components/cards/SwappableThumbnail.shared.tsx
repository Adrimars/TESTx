import { Image, StyleSheet, Text } from "react-native";
import { resolveMediaUrl } from "@/lib/env";
import type { EvaluatorOption } from "@/lib/test";
import { theme } from "@/lib/theme";

/** How long a placed card's thumbnail must be held before it starts dragging for a swap
 * (15.6), rather than being read as the start of a tap-to-reclaim. Shared by the native
 * long-press gesture and the web pointer-event reimplementation below, so the two platforms
 * agree on when a hold has become a drag. */
export const SWAP_LONG_PRESS_MS = 350;
/** Place entrance starting point (16.9): eases from larger/more-transparent to resting
 * scale (1) and opacity (1), shrinking down into the slot rather than snapping there. */
export const PLACE_ENTRANCE_START_SCALE = 1.15;
export const ENTRANCE_START_OPACITY = 0.4;
export const MAX_SLOT_SCALE = 1.45;
export const PROXIMITY_FALLOFF = 170;

/**
 * Where a swap drag's `translateY` currently sits relative to the slot it would land on
 * (16.1): which slot value that is (0 if still over the source slot, or past either end
 * with nowhere valid to land), and how close - 0 (mid-transition) to 1 (dead on that
 * slot's centre). Same "grow near a target" shape as `targetProximity`, just measured
 * along this gesture's 1D `translateY` instead of 2D pointer coordinates, since a swap
 * drag never tracks the raw finger position (see the native/web `SwappableThumbnail`s).
 */
export function computeSwapCrossing(
  translateY: number,
  slotHeight: number,
  slotValue: number,
  slotCount: number
): { targetValue: number; nearness: number } {
  "worklet";
  // Downward drag moves toward the bottom of the column, where rank 1 sits after 15.3's
  // flip - value decreases as the finger moves down, hence the negation.
  const delta = Math.round(-translateY / slotHeight);
  if (delta === 0) return { targetValue: 0, nearness: 0 };
  const targetValue = Math.max(1, Math.min(slotCount, slotValue + delta));
  if (targetValue === slotValue) return { targetValue: 0, nearness: 0 };
  const targetTranslateY = -delta * slotHeight;
  const distance = Math.abs(translateY - targetTranslateY);
  const nearness = distance >= PROXIMITY_FALLOFF ? 0 : 1 - distance / PROXIMITY_FALLOFF;
  return { targetValue, nearness };
}

/** A placed option's photo, small enough to fit in a slot - lets the evaluator see the
 * whole ranking at a glance instead of just slot numbers. Falls back to an initial for
 * non-image media, same as CardMedia's own TEXT fallback but sized for the slot. */
export function SlotThumbnail({
  option,
  mediaType,
}: {
  option: EvaluatorOption;
  mediaType: string | null;
}) {
  const resolved = mediaType === "IMAGE" ? resolveMediaUrl(option.mediaUrl) : null;
  if (!resolved) {
    return (
      <Text style={sharedStyles.slotTextFilled} numberOfLines={1}>
        {(option.label ?? "?").charAt(0).toUpperCase()}
      </Text>
    );
  }
  return <Image source={{ uri: resolved }} style={sharedStyles.slotThumbnail} resizeMode="cover" />;
}

export const sharedStyles = StyleSheet.create({
  slotThumbnailPressable: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  slotTextFilled: { color: theme.colors.accentContrast, fontSize: 18, fontWeight: "700" },
  slotThumbnail: { width: "100%", height: "100%" },
});

export type SwappableThumbnailProps = {
  slotValue: number;
  slotCount: number;
  slotHeight: number;
  option: EvaluatorOption;
  mediaType: string | null;
  disabled: boolean;
  onReclaim: (slotNumber: number) => void;
  onSwap: (sourceValue: number, targetValue: number) => void;
  swapTargetValue: import("react-native-reanimated").SharedValue<number>;
  swapNearness: import("react-native-reanimated").SharedValue<number>;
  /** Fires the moment a swap drag actually begins (after the long-press threshold) -
   * teaching the swap gesture is "done" the instant the evaluator starts doing it, same as
   * the placement drag's own onDragStart-driven dismiss. */
  onSwapDragStart?: () => void;
};
