import type { ReactNode } from "react";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { CARD_ENTRANCE_SPRING, REDUCED_MOTION_FADE_MS } from "@/lib/motion";
import { theme } from "@/lib/theme";

/** Cards drawn behind the active one, so the deck reads as a deck and not a single card. */
const DEFAULT_PEEK_COUNT = 2;
const PEEK_SCALE_STEP = 0.04;
const PEEK_OFFSET_STEP = 12;
const PEEK_OPACITY_STEP = 0.2;
/**
 * A peeking card's own prompt/caption text stays fully opaque even as the card itself
 * dims (see `slot`'s opacity below) - at one step back that is still legible enough to
 * visually mix with the active card's text. This scrim sits on top of a peeking card only,
 * covering its content rather than the whole card's opacity, so the stack still reads as
 * a stack of cards while only the active one reads as text.
 */
const SCRIM_BASE_OPACITY = 0.55;
const SCRIM_OPACITY_STEP = 0.2;

type CardStackProps<T> = {
  /** The whole queue. The stack only ever draws a short window of it. */
  items: T[];
  /** Index into `items` of the card currently accepting gestures. */
  activeIndex: number;
  renderCard: (item: T, isActive: boolean) => ReactNode;
  /** How many cards peek out behind the active one. */
  peekCount?: number;
  keyExtractor: (item: T, index: number) => string;
};

/**
 * Draws the active card plus a couple of upcoming ones behind it.
 *
 * The peeking cards are rendered first and the active card last, because React Native on
 * Android honours draw order more reliably than zIndex for siblings. They are also inert:
 * only the active card is handed to a gesture detector, so a stray touch on a card behind
 * cannot answer a question the evaluator has not reached yet.
 *
 * A card that leaves the window unmounts, which is what resets its drag offset and its
 * committed latch. Back/undo (10.7) depends on that: stepping `activeIndex` back remounts
 * the previous card clean rather than restoring one that already flew away. Keep
 * `keyExtractor` keyed on the card's own identity, never on its position in the queue.
 */
export function CardStack<T>({
  items,
  activeIndex,
  renderCard,
  peekCount = DEFAULT_PEEK_COUNT,
  keyExtractor,
}: CardStackProps<T>) {
  const window: { item: T; index: number }[] = [];
  for (let offset = 0; offset <= peekCount; offset += 1) {
    const index = activeIndex + offset;
    const item = items[index];
    if (item === undefined) break;
    window.push({ item, index });
  }

  return (
    <View style={styles.container}>
      {window
        .slice()
        .reverse()
        .map(({ item, index }) => {
          const depth = index - activeIndex;
          const isActive = depth === 0;

          return (
            <CardStackSlot key={keyExtractor(item, index)} depth={depth} isActive={isActive}>
              {renderCard(item, isActive)}
            </CardStackSlot>
          );
        })}
    </View>
  );
}

/**
 * One card's own animated position in the stack, split out so it can own the shared value
 * that eases it there. `depth` only ever moves by whole steps between renders (peek shuffle
 * or crossing into active), and this component stays mounted across those changes for as
 * long as the card stays inside the window (see the class doc above) - so animating toward
 * a new `depth` on every change, rather than snapping, is what turns "peek 1 becomes active"
 * into a rise/scale/fade instead of a jump cut (16.2). A card's first render already starts
 * at its correct resting `depth` (`useSharedValue(depth)`), so freshly entering the back of
 * the window is unaffected - there is nothing to ease from.
 */
function CardStackSlot({
  depth,
  isActive,
  children,
}: {
  depth: number;
  isActive: boolean;
  children: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  // Transform only - Reduced Motion must never animate scale/translate (see motion.ts),
  // so this jumps straight to the target there instead of springing toward it.
  const depthValue = useSharedValue(depth);
  // Opacity is kept separate so it can still fade under Reduced Motion while the
  // transform above snaps - a spring's smooth curve everywhere else, otherwise.
  const opacityValue = useSharedValue(1 - PEEK_OPACITY_STEP * depth);

  useEffect(() => {
    depthValue.value = reducedMotion ? depth : withSpring(depth, CARD_ENTRANCE_SPRING);
    const targetOpacity = 1 - PEEK_OPACITY_STEP * depth;
    opacityValue.value = reducedMotion
      ? withTiming(targetOpacity, { duration: REDUCED_MOTION_FADE_MS })
      : withSpring(targetOpacity, CARD_ENTRANCE_SPRING);
  }, [depth, depthValue, opacityValue, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 - PEEK_SCALE_STEP * depthValue.value },
      { translateY: PEEK_OFFSET_STEP * depthValue.value },
    ],
    opacity: opacityValue.value,
  }));

  return (
    <Animated.View style={[styles.slot, isActive ? null : NO_TOUCH, animatedStyle]}>
      {children}
      {!isActive ? (
        <View
          style={[
            styles.scrim,
            NO_TOUCH,
            { opacity: Math.min(SCRIM_BASE_OPACITY + SCRIM_OPACITY_STEP * depth, 1) },
          ]}
        />
      ) : null}
    </Animated.View>
  );
}

/** Inert overlay: the deprecated pointerEvents prop moved onto style. */
const NO_TOUCH = { pointerEvents: "none" } as const;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Every card occupies the same box, so the peeking ones sit exactly behind the
  // active one rather than shifting the layout as the deck advances.
  slot: {
    position: "absolute",
    top: theme.spacing(2),
    right: theme.spacing(2),
    bottom: theme.spacing(2),
    left: theme.spacing(2),
  },
  // Matches the shared Card radius so the scrim never peeks past the card's edge.
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: theme.card.shadow.borderRadius,
    backgroundColor: theme.colors.surfaceBase,
  },
});
