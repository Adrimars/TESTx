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
