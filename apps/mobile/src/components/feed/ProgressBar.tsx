import { StyleSheet, View } from "react-native";
import { theme } from "@/lib/theme";

type ProgressBarProps = {
  /** Questions in the current test. One segment per question. */
  total: number;
  /** The deck's current index - segments before it are answered, this one is active. */
  index: number;
};

/**
 * Instagram-Stories-style thin segmented bar, one segment per question in the current
 * test (plan.md 11.2).
 *
 * Reads straight off `deck.index`/the question count rather than tracking its own
 * progress state, so it stays correct after Back for free - the same index that moves
 * the card stack moves this. It resets because `TestDeck` is keyed by test id and
 * remounts clean on every new test, the same way `CardStack` resets a card by unmounting
 * it (see CardStack.tsx).
 */
export function ProgressBar({ total, index }: ProgressBarProps) {
  if (total <= 0) return null;

  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, segment) => (
        <View key={segment} style={styles.track}>
          <View
            style={[
              styles.fill,
              segment < index && styles.filled,
              segment === index && styles.active,
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    // Progress segments, per prd.md §16.6: 2px bars, 2px gaps.
    gap: 2,
    paddingHorizontal: theme.spacing(2),
  },
  track: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceOverlay,
  },
  fill: {
    flex: 1,
    backgroundColor: "transparent",
  },
  filled: { backgroundColor: theme.colors.accent },
  active: { backgroundColor: theme.colors.textSecondary },
});
