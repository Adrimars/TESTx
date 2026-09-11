import type { MutableRefObject, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { GestureType } from "react-native-gesture-handler";
import Animated, { runOnJS } from "react-native-reanimated";

type TapZoneProps = {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  accessibilityLabel?: string;
  /**
   * Exposes this zone's underlying Tap gesture so a parent `SwipeCard` can list it in its
   * own `waitFor` - required whenever a `TapZone` is nested inside a `SwipeCard` (its Pan
   * would otherwise claim the touch before this Tap ever gets to recognize it, see
   * `SwipeCard`'s `waitFor` doc). Not needed for a `TapZone` used as a sibling overlay.
   */
  gestureRef?: MutableRefObject<GestureType | undefined>;
};

/**
 * A tap target built on react-native-gesture-handler's own Tap gesture, not RN's
 * `Pressable`.
 *
 * Every place this is used sits visually on top of - or right next to - a `SwipeCard`'s
 * drag surface (a target pill, a ranking slot, a caption button). Mixing RN's
 * responder-based `Pressable` with RNGH's native gesture recognizers in the same screen
 * region is an unreliable combination: whichever system's view is hit-tested first can
 * swallow the touch before the other ever sees it, and that has nothing to do with which
 * gesture is a "better fit" for the tap - it is default RN responder handling. Staying
 * inside RNGH end to end keeps the arbitration between drag and tap in one system.
 *
 * When nested inside a SwipeCard (TwoOptionCard's two halves, MultiSelectCard's caption
 * buttons), pass `gestureRef` and list it in the SwipeCard's own `waitFor`. Confirmed on
 * this app's web build that the tap was being swallowed there - but SwipeCard.web bypasses
 * RNGH's Pan entirely (its own doc explains why) and hijacks the pointer itself, so that
 * repro says nothing about RNGH's native nested-handler defaults one way or the other.
 * `requireExternalGestureToFail` is the documented mechanism for making a parent Pan wait
 * on a nested Tap regardless of what the default turns out to be, matching the
 * `Gesture.Race(pan, tap)` this codebase already uses for the same tap-vs-drag arbitration
 * on one shared view (SwappableThumbnail) - but **whether native needed this wiring at all
 * is still unverified on-device**, same open question the original version of this comment
 * flagged: confirm a slow press-then-drag on a TwoOptionCard half still moves the card
 * before trusting this path on a real phone.
 */
export function TapZone({
  onPress,
  disabled = false,
  style,
  children,
  accessibilityLabel,
  gestureRef,
}: TapZoneProps) {
  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDistance(10)
    .onEnd((_event, success) => {
      if (success) runOnJS(onPress)();
    });
  if (gestureRef) tap.withRef(gestureRef);

  return (
    <GestureDetector gesture={tap}>
      <Animated.View
        style={style}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
