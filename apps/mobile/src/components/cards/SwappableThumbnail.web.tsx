import { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { CARD_ENTRANCE_SPRING, CARD_REJECT_SPRING, REDUCED_MOTION_FADE_MS } from "@/lib/motion";
import {
  ENTRANCE_START_OPACITY,
  MAX_SLOT_SCALE,
  PLACE_ENTRANCE_START_SCALE,
  SWAP_LONG_PRESS_MS,
  SlotThumbnail,
  computeSwapCrossing,
  sharedStyles,
} from "./SwappableThumbnail.shared";
import type { SwappableThumbnailProps } from "./SwappableThumbnail.shared";

/** Movement past this, before the hold threshold elapses, cancels both the swap-drag and
 * the reclaim tap - matches the native file's `Gesture.Tap().maxDistance(10)`. */
const TAP_MAX_DISTANCE = 10;

/**
 * Web override.
 *
 * RNGH's web Pan recognizer did not reliably turn pointer input into position deltas in
 * this app's own testing (documented on `SwipeCard.web.tsx`, which exists for exactly this
 * reason) - the placement drag got that fix, but this swap gesture used the same raw
 * `Gesture.Pan()` unmodified until now. So this reimplements the same press-and-hold-then-
 * drag recognition by hand: a `setTimeout` stands in for `activateAfterLongPress`, and raw
 * `pointerdown`/`pointermove`/`pointerup` drive the same `translateY` SharedValue and the
 * same `onSwap`/`onReclaim` callbacks the native file does. Everything below - the crossing
 * math, the entrance/reject springs, the rendered thumbnail - is copied from the native
 * file unchanged.
 */
export function SwappableThumbnail({
  slotValue,
  slotCount,
  slotHeight,
  option,
  mediaType,
  disabled,
  onReclaim,
  onSwap,
  swapTargetValue,
  swapNearness,
  onSwapDragStart,
}: SwappableThumbnailProps) {
  const translateY = useSharedValue(0);

  const reducedMotion = useReducedMotion();
  const placeEntranceScale = useSharedValue(reducedMotion ? 1 : PLACE_ENTRANCE_START_SCALE);
  const placeEntranceOpacity = useSharedValue(reducedMotion ? 1 : ENTRANCE_START_OPACITY);

  useEffect(() => {
    if (reducedMotion) {
      placeEntranceOpacity.value = withTiming(1, { duration: REDUCED_MOTION_FADE_MS });
      return;
    }
    placeEntranceScale.value = withSpring(1, CARD_ENTRANCE_SPRING);
    placeEntranceOpacity.value = withSpring(1, CARD_ENTRANCE_SPRING);
  }, [reducedMotion, placeEntranceScale, placeEntranceOpacity]);

  const nodeRef = useRef<View>(null);
  const activePointerId = useRef<number | null>(null);
  const startClientY = useRef(0);
  const startClientX = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panActivated = useRef(false);
  const movedTooFar = useRef(false);

  function clearHoldTimer() {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function resetTracking() {
    activePointerId.current = null;
    panActivated.current = false;
    movedTooFar.current = false;
    clearHoldTimer();
  }

  function handlePointerDown(event: {
    nativeEvent: { pointerId: number; clientX: number; clientY: number; button: number };
  }) {
    if (disabled) return;
    if (event.nativeEvent.button !== 0) return;
    const node = nodeRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const { pointerId, clientX, clientY } = event.nativeEvent;
    try {
      node.setPointerCapture?.(pointerId);
    } catch {
      // Ignored - see SwipeCard.web.tsx's identical handling.
    }
    activePointerId.current = pointerId;
    startClientX.current = clientX;
    startClientY.current = clientY;
    panActivated.current = false;
    movedTooFar.current = false;

    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      panActivated.current = true;
      if (onSwapDragStart) onSwapDragStart();
    }, SWAP_LONG_PRESS_MS);
  }

  function handlePointerMove(event: { nativeEvent: { pointerId: number; clientX: number; clientY: number } }) {
    const { pointerId, clientX, clientY } = event.nativeEvent;
    if (activePointerId.current === null || pointerId !== activePointerId.current) return;

    if (!panActivated.current) {
      const dx = clientX - startClientX.current;
      const dy = clientY - startClientY.current;
      // Moving before the hold elapses reads as neither a steady hold nor a clean tap -
      // matches the native file's Tap().maxDistance(10) rejecting the same movement.
      if (Math.abs(dx) > TAP_MAX_DISTANCE || Math.abs(dy) > TAP_MAX_DISTANCE) {
        movedTooFar.current = true;
        clearHoldTimer();
      }
      return;
    }

    translateY.value = clientY - startClientY.current;
  }

  function handlePointerUp(event: { nativeEvent: { pointerId: number } }) {
    const { pointerId } = event.nativeEvent;
    if (activePointerId.current === null || pointerId !== activePointerId.current) return;
    const node = nodeRef.current as unknown as HTMLElement | null;
    try {
      node?.releasePointerCapture?.(pointerId);
    } catch {
      // Ignored - the pointer may already be gone by the time this runs.
    }

    if (panActivated.current) {
      const { targetValue } = computeSwapCrossing(translateY.value, slotHeight, slotValue, slotCount);
      translateY.value = withSpring(0, CARD_REJECT_SPRING);
      if (targetValue !== 0) onSwap(slotValue, targetValue);
    } else if (!movedTooFar.current) {
      onReclaim(slotValue);
    }

    resetTracking();
  }

  function handlePointerCancel(event: { nativeEvent: { pointerId: number } }) {
    const { pointerId } = event.nativeEvent;
    if (activePointerId.current === null || pointerId !== activePointerId.current) return;
    const wasActivated = panActivated.current;
    resetTracking();
    // No deliberate release happened - spring back rather than commit a swap.
    if (wasActivated) {
      translateY.value = withSpring(0, CARD_REJECT_SPRING);
    }
  }

  // Broadcasts the currently-crossed slot (if any) so that slot's own RankSlot can grow in
  // step with this thumbnail - identical to the native file's reaction. `useAnimatedReaction`
  // is a Reanimated primitive, not an RNGH one, and renders correctly on web the same way
  // DragHint's own animated styles already do (see SwipeCard.web.tsx's doc: the web bug is
  // specific to RNGH's Pan recognizer, not to Reanimated).
  useAnimatedReaction(
    () => translateY.value,
    (ty) => {
      const { targetValue, nearness } = computeSwapCrossing(ty, slotHeight, slotValue, slotCount);
      swapTargetValue.value = targetValue;
      swapNearness.value = nearness;
    },
    [slotHeight, slotValue, slotCount]
  );

  const followFinger = useAnimatedStyle(() => {
    const { nearness } = computeSwapCrossing(translateY.value, slotHeight, slotValue, slotCount);
    return {
      opacity: placeEntranceOpacity.value,
      transform: [
        { translateY: translateY.value },
        { scale: placeEntranceScale.value * (1 + nearness * (MAX_SLOT_SCALE - 1)) },
      ],
      zIndex: translateY.value === 0 ? 0 : 1,
    };
  });

  return (
    <Animated.View
      ref={nodeRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={[sharedStyles.slotThumbnailPressable, styles.touchNone, followFinger]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Rank ${slotValue}: ${option.label ?? "this card"}. Tap to remove it, or hold and drag to swap with another rank.`}
      accessibilityState={{ disabled }}
    >
      <SlotThumbnail option={option} mediaType={mediaType} />
    </Animated.View>
  );
}

const styles = { touchNone: { touchAction: "none" } } as const;
