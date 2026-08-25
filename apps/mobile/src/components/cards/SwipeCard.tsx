import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { theme } from "@/lib/theme";

/** Card offset from its resting position, in pixels. Lives on the UI thread. */
export type DragPosition = { x: SharedValue<number>; y: SharedValue<number> };

export type ReleaseGesture = {
  /** Card offset from its resting position. Drives directional swipes. */
  x: number;
  y: number;
  /**
   * Where the finger is, as an offset from the card's resting centre.
   *
   * This is what drag-to-target hit-tests against, not `x`/`y`. Grab a card by its bottom
   * corner and the finger sits a long way from the card's middle, so aiming the finger at
   * a target lands the card's centre somewhere else - the pill under your finger is not
   * the one that commits. Equal to `x`/`y` only when the card is grabbed dead centre.
   */
  pointerX: number;
  pointerY: number;
  velocityX: number;
  velocityY: number;
};

/**
 * What letting go of the card means. Returned from a worklet, so it has to stay a
 * plain object — no class instances, no functions.
 *
 * `value` is whatever the caller needs to identify the choice: an option index for a
 * two-option select, a 1-5 rating, a slot number for a ranking. It is handed back to
 * `onCommit` only after the fly-away animation finishes, so the deck never advances
 * while the card the evaluator is looking at is still moving.
 */
export type ReleaseDecision =
  | { commit: false }
  | { commit: true; value: number; flyTo?: { x: number; y: number } };

const RETURN_SPRING = { damping: 18, stiffness: 220, mass: 0.7 } as const;
const FLY_AWAY_MS = 180;

/** How far a committed card travels before it stops being drawn. */
const DEFAULT_FLY_DISTANCE = 700;

type SwipeCardProps = {
  children: ReactNode;
  /**
   * Decides what a release means. **Must be a worklet** (`'worklet'` directive) —
   * it runs on the UI thread so the card can start settling in the same frame the
   * finger lifts, rather than after a round trip to JS.
   */
  onRelease: (gesture: ReleaseGesture) => ReleaseDecision;
  /** Runs on the JS thread once a committed card has finished flying away. */
  onCommit?: (value: number) => void;
  /**
   * Runs on the JS thread the moment a drag begins. Used to retire the first-run gesture
   * hint: the evaluator dismisses it by performing the gesture it is teaching.
   */
  onDragStart?: () => void;
  /**
   * Drag offset, owned by the parent when it needs to react to the card's position —
   * target proximity in Rating and Ranking. Omit for cards nothing else tracks.
   *
   * Pass this to the **active card only**. Handing the same pair to the peeking cards
   * behind it would bind them all to one offset, and the whole deck would slide as one.
   */
  position?: DragPosition;
  /**
   * Finger offset from the card's resting centre, for parents that light up the target
   * under the finger. Same active-card-only rule as `position`.
   */
  pointer?: DragPosition;
  /** False renders the card as a static surface: the 3+ option select does not drag. */
  enabled?: boolean;
  /** Degrees of tilt at the horizontal edges of the screen. 0 keeps the card flat. */
  maxTiltDeg?: number;
  /** Screen width, used to scale the tilt and the default fly-away. */
  width: number;
  style?: StyleProp<ViewStyle>;
};

export function SwipeCard({
  children,
  onRelease,
  onCommit,
  onDragStart,
  position,
  pointer,
  enabled = true,
  maxTiltDeg = 8,
  width,
  style,
}: SwipeCardProps) {
  const ownX = useSharedValue(0);
  const ownY = useSharedValue(0);
  const ownPointerX = useSharedValue(0);
  const ownPointerY = useSharedValue(0);
  const translateX = position?.x ?? ownX;
  const translateY = position?.y ?? ownY;
  const pointerX = pointer?.x ?? ownPointerX;
  const pointerY = pointer?.y ?? ownPointerY;

  /**
   * Where on the card the finger grabbed it, relative to the card's centre. Fixed for the
   * life of the gesture - the finger keeps its spot on the card while dragging - so this
   * plus the translation is where the finger actually is.
   */
  const grabX = useSharedValue(0);
  const grabY = useSharedValue(0);

  // Card size, needed to turn a touch position into an offset from the card's centre.
  // Measured rather than derived, because the card's height depends on the deck chrome
  // above it, which this component deliberately knows nothing about.
  const boxWidth = useSharedValue(0);
  const boxHeight = useSharedValue(0);

  // Latches once a commit starts. Without it a fast second drag can grab a card that
  // is already flying away and drop it back into the deck, committing twice.
  const isSettling = useSharedValue(false);

  // The commit callback hangs off this rather than off either axis. A drag-to-target
  // release can be almost entirely vertical or almost entirely horizontal, so neither
  // translate is guaranteed to change - and an animation whose start already equals its
  // end is exactly the kind of thing to be careful with when a whole deck depends on the
  // callback firing. This always runs 0 to 1.
  const settleProgress = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .onStart((event) => {
      if (isSettling.value) return;
      // event.x/y are relative to the card's own box, so subtracting half its size gives
      // the grab point relative to the card's centre.
      grabX.value = boxWidth.value > 0 ? event.x - boxWidth.value / 2 : 0;
      grabY.value = boxHeight.value > 0 ? event.y - boxHeight.value / 2 : 0;
      pointerX.value = grabX.value;
      pointerY.value = grabY.value;
      if (onDragStart) runOnJS(onDragStart)();
    })
    .onUpdate((event) => {
      if (isSettling.value) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      pointerX.value = grabX.value + event.translationX;
      pointerY.value = grabY.value + event.translationY;
    })
    .onEnd((event) => {
      if (isSettling.value) return;

      const decision = onRelease({
        x: translateX.value,
        y: translateY.value,
        pointerX: pointerX.value,
        pointerY: pointerY.value,
        velocityX: event.velocityX,
        velocityY: event.velocityY,
      });

      if (!decision.commit) {
        translateX.value = withSpring(0, RETURN_SPRING);
        translateY.value = withSpring(0, RETURN_SPRING);
        // The highlight has to leave with the card, or the last target stays lit after a
        // miss and reads as a selection that was never made.
        pointerX.value = withSpring(0, RETURN_SPRING);
        pointerY.value = withSpring(0, RETURN_SPRING);
        return;
      }

      isSettling.value = true;
      const target = decision.flyTo ?? {
        x: Math.sign(translateX.value || event.velocityX || 1) * DEFAULT_FLY_DISTANCE,
        y: translateY.value,
      };
      const committed = decision.value;

      translateX.value = withTiming(target.x, { duration: FLY_AWAY_MS });
      translateY.value = withTiming(target.y, { duration: FLY_AWAY_MS });

      settleProgress.value = 0;
      settleProgress.value = withTiming(1, { duration: FLY_AWAY_MS }, (finished) => {
        if (finished && onCommit) {
          runOnJS(onCommit)(committed);
        }
      });
    });

  const animatedStyle = useAnimatedStyle(() => {
    const tilt =
      maxTiltDeg === 0
        ? 0
        : interpolate(translateX.value, [-width, 0, width], [-maxTiltDeg, 0, maxTiltDeg]);

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotateZ: `${tilt}deg` },
      ],
    };
  });

  function onLayout(event: LayoutChangeEvent) {
    boxWidth.value = event.nativeEvent.layout.width;
    boxHeight.value = event.nativeEvent.layout.height;
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View onLayout={onLayout} style={[styles.card, style, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
    overflow: "hidden",
  },
});
