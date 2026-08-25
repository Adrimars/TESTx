import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "@/lib/theme";

/** Cards drawn behind the active one, so the deck reads as a deck and not a single card. */
const DEFAULT_PEEK_COUNT = 2;
const PEEK_SCALE_STEP = 0.04;
const PEEK_OFFSET_STEP = 12;

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
            <View
              key={keyExtractor(item, index)}
              style={[
                styles.slot,
                isActive ? null : NO_TOUCH,
                !isActive && {
                  transform: [
                    { scale: 1 - PEEK_SCALE_STEP * depth },
                    { translateY: PEEK_OFFSET_STEP * depth },
                  ],
                  opacity: 1 - 0.2 * depth,
                },
              ]}
            >
              {renderCard(item, isActive)}
            </View>
          );
        })}
    </View>
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
});
