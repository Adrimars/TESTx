import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
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
  x: number;
  y: number;
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
   * Drag offset, owned by the parent when it needs to react to the card's position —
   * target proximity in Rating and Ranking. Omit for cards nothing else tracks.
   *
   * Pass this to the **active card only**. Handing the same pair to the peeking cards
   * behind it would bind them all to one offset, and the whole deck would slide as one.
   */
  position?: DragPosition;
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
  position,
  enabled = true,
  maxTiltDeg = 8,
  width,
  style,
}: SwipeCardProps) {
  const ownX = useSharedValue(0);
  const ownY = useSharedValue(0);
  const translateX = position?.x ?? ownX;
  const translateY = position?.y ?? ownY;

  // Latches once a commit starts. Without it a fast second drag can grab a card that
  // is already flying away and drop it back into the deck, committing twice.
  const isSettling = useSharedValue(false);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .onUpdate((event) => {
      if (isSettling.value) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      if (isSettling.value) return;

      const decision = onRelease({
        x: translateX.value,
        y: translateY.value,
        velocityX: event.velocityX,
        velocityY: event.velocityY,
      });

      if (!decision.commit) {
        translateX.value = withSpring(0, RETURN_SPRING);
        translateY.value = withSpring(0, RETURN_SPRING);
        return;
      }

      isSettling.value = true;
      const target = decision.flyTo ?? {
        x: Math.sign(translateX.value || event.velocityX || 1) * DEFAULT_FLY_DISTANCE,
        y: translateY.value,
      };
      const committed = decision.value;

      translateX.value = withTiming(target.x, { duration: FLY_AWAY_MS });
      translateY.value = withTiming(target.y, { duration: FLY_AWAY_MS }, (finished) => {
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

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, style, animatedStyle]}>{children}</Animated.View>
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
