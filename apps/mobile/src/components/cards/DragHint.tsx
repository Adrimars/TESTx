import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { theme } from "@/lib/theme";

const GHOST_SIZE = 72;
const TRAVEL_MS = 900;
const PAUSE_MS = 350;

type DragHintProps = {
  /** How far right and how far up/down the ghost travels, matching the real target. */
  toX: number;
  toY: number;
  message: string;
  /**
   * Overrides the message box's own position/width, on top of the default (inset from
   * this overlay's own left/right edges - fine when the overlay sits over the full-width
   * gesture surface it's teaching). Needed when the overlay instead sits over a much
   * narrower parent - RankingCard's swap hint lives inside its rank column, a sliver next
   * to the photo - since wrapping the message to that column's own width there reads as a
   * near-vertical stack of words rather than a sentence. Passing a wider, left-shifted box
   * here lets the text span the full row while the ghost and background dimming stay
   * scoped to the narrower parent they're actually demonstrating.
   */
  messageWrapStyle?: StyleProp<ViewStyle>;
};

/**
 * A ghost card that drags itself to a target, shown once per novel gesture.
 *
 * It is an overlay rather than a modal with a dismiss button: the evaluator gets rid of
 * it by doing the gesture, which is the thing being taught. A button would teach tapping.
 */
export function DragHint({ toX, toY, message, messageWrapStyle }: DragHintProps) {
  const progress = useSharedValue(0);
  // Reduce Motion (see lib/motion.ts): the ghost must never translate. It stays put next
  // to the message, which already names the gesture in words.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    progress.value = 0;
    if (reducedMotion) return;
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: TRAVEL_MS, easing: Easing.inOut(Easing.quad) }),
        withDelay(PAUSE_MS, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
  }, [progress, reducedMotion]);

  const ghost = useAnimatedStyle(() => ({
    transform: [
      { translateX: reducedMotion ? 0 : progress.value * toX },
      { translateY: reducedMotion ? 0 : progress.value * toY },
    ],
    // Fades out as it lands, so the loop restarting does not read as the card snapping back.
    opacity: reducedMotion ? 0.8 : 0.25 + 0.55 * (1 - progress.value),
  }));

  return (
    <View style={[styles.overlay, NO_TOUCH]}>
      <View style={[styles.messageWrap, messageWrapStyle]}>
        <Text style={styles.message}>{message}</Text>
      </View>
      <Animated.View style={[styles.ghost, ghost]}>
        <Text style={styles.ghostGlyph}>{"⇢"}</Text>
      </Animated.View>
    </View>
  );
}

/** Inert overlay: the deprecated pointerEvents prop moved onto style. */
const NO_TOUCH = { pointerEvents: "none" } as const;

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.withAlpha(theme.colors.surfaceBase, 0.55),
  },
  messageWrap: {
    position: "absolute",
    top: theme.spacing(3),
    left: theme.spacing(3),
    right: theme.spacing(3),
  },
  message: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 21,
  },
  ghost: {
    width: GHOST_SIZE,
    height: GHOST_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surfaceRaised,
  },
  ghostGlyph: { color: theme.colors.accent, fontSize: 30, fontWeight: "700" },
});
