import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
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

const RING_SIZE = 56;
const PULSE_MS = 700;
const PAUSE_MS = 350;

type TapHintProps = {
  message: string;
};

/**
 * A pulsing tap indicator, shown once per novel gesture - the tap sibling of `DragHint`'s
 * drag-to-target ghost. Not tied to any one option's coordinates: the list it sits over
 * (OptionListCard's grid, a swipe card's caption buttons) can hold any number of options
 * in any layout, so the ring pulses in place rather than pointing at a specific one - the
 * message text is what names which control to tap.
 *
 * Dismissed by the evaluator doing the gesture, same as DragHint - no button, because a
 * button would teach tapping something that isn't the answer.
 */
export function TapHint({ message }: TapHintProps) {
  const progress = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    progress.value = 0;
    if (reducedMotion) return;
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.quad) }),
        withDelay(PAUSE_MS, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
  }, [progress, reducedMotion]);

  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : 1 + progress.value * 0.6 }],
    opacity: reducedMotion ? 0.8 : 0.7 * (1 - progress.value),
  }));

  return (
    <View style={[styles.overlay, NO_TOUCH]}>
      <View style={styles.messageWrap}>
        <Text style={styles.message}>{message}</Text>
      </View>
      <View style={styles.ringAnchor}>
        <Animated.View style={[styles.ring, ring]} />
        <View style={styles.dot} />
      </View>
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
  ringAnchor: { alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
    borderColor: theme.colors.accent,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.accent,
  },
});
