import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS } from "react-native-reanimated";

type TapZoneProps = {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  accessibilityLabel?: string;
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
 * When nested inside a SwipeCard (TwoOptionCard's two halves are literally its whole
 * surface), this relies on RNGH's default nested-handler behaviour: a child gesture gets
 * first refusal on a touch, and only once it fails - here, once the finger travels past
 * `maxDistance` - does the ancestor's Pan pick the same touch back up, with no explicit
 * `Gesture.Exclusive`/`requireExternalGestureToFail` wiring needed for a direct
 * parent-child pair. That default is what makes this safe to nest rather than only safe
 * as a sibling overlay (Rating/Ranking/MultiSelect's case) - **verify a slow drag started
 * on a TwoOptionCard half still moves the card on-device**; this is the one thing here
 * that reading the code cannot confirm.
 */
export function TapZone({ onPress, disabled = false, style, children, accessibilityLabel }: TapZoneProps) {
  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDistance(10)
    .onEnd((_event, success) => {
      if (success) runOnJS(onPress)();
    });

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
