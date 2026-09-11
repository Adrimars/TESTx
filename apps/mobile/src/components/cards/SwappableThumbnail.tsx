import { useEffect } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
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

/**
 * A filled slot's own thumbnail (native): a tap reclaims it (existing 12.1/12.6 flow,
 * unchanged), and a press-and-hold followed by a drag swaps it directly with whatever slot
 * the finger ends up over (15.6) - a shortcut alongside reclaim-then-place, not instead of
 * it.
 *
 * `Gesture.Race` picks whichever of the two actually activates: a quick tap wins before
 * the hold threshold ever fires; holding still past it activates the pan instead, and the
 * tap is cancelled by Race the moment that happens. Reading the swap target off
 * `translationY` alone - rather than re-deriving pointer coordinates in this thumbnail's
 * own space - works because every slot sits exactly `slotHeight` from its neighbour, so
 * "how many slots did the finger cross" is just that division, independent of which slot
 * this drag started on.
 *
 * See `SwappableThumbnail.web.tsx` for why this file has a web sibling: RNGH's web Pan
 * recognizer did not reliably work in this app's own testing (documented on SwipeCard.web),
 * and this gesture never got that fix until now.
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

  // Place entrance (16.9): this component only ever mounts fresh the moment a slot goes
  // from empty to filled - a swap (15.6) reuses the same instance, just changing `option`
  // - so a plain mount effect is exactly "a card was just placed here", no extra state to
  // track. Shrinks down from larger/more-transparent to resting size/opacity.
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

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDistance(10)
    .onEnd((_event, success) => {
      if (success) runOnJS(onReclaim)(slotValue);
    });

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(SWAP_LONG_PRESS_MS)
    .onStart(() => {
      if (onSwapDragStart) runOnJS(onSwapDragStart)();
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const { targetValue } = computeSwapCrossing(event.translationY, slotHeight, slotValue, slotCount);
      // Springing back to 0 here also carries the shared crossing state below back to
      // resting (its reaction keeps firing for every frame of this animation), so both
      // this thumbnail and whichever slot it was over settle together off one spring.
      translateY.value = withSpring(0, CARD_REJECT_SPRING);
      if (targetValue !== 0) runOnJS(onSwap)(slotValue, targetValue);
    });

  // Broadcasts the currently-crossed slot (if any) so that slot's own RankSlot can grow
  // in step with this thumbnail - fires on every frame translateY changes, including
  // during the release spring above, which is what lets the highlight fade back out
  // smoothly instead of snapping off the instant the gesture ends.
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
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Animated.View
        style={[sharedStyles.slotThumbnailPressable, followFinger]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Rank ${slotValue}: ${option.label ?? "this card"}. Tap to remove it, or hold and drag to swap with another rank.`}
        accessibilityState={{ disabled }}
      >
        <SlotThumbnail option={option} mediaType={mediaType} />
      </Animated.View>
    </GestureDetector>
  );
}
