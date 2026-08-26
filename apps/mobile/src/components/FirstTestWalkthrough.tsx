import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckSquare, Hand, ListOrdered, MoveHorizontal, MoveVertical } from "lucide-react-native";
import { theme } from "@/lib/theme";

type SlideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

type Slide = {
  Icon: SlideIcon;
  title: string;
  body: string;
};

/**
 * One slide per question type the evaluator can meet in a test (15.7's exit criterion),
 * in the same order the deck itself tends to introduce them: the universal gesture first,
 * then the two novel drag-to-target ones last, since those are the ones worth lingering on.
 */
const SLIDES: Slide[] = [
  {
    Icon: MoveHorizontal,
    title: "Swipe to choose",
    body: "When a question has two options, swipe the card left or right to pick a side.",
  },
  {
    Icon: CheckSquare,
    title: "Tap to choose",
    body: "When there are more than two options, just tap the one you want.",
  },
  {
    Icon: Hand,
    title: "Swipe to like or skip",
    body: "For a pick-some question, one option shows at a time. Swipe right to include it, left to skip it - liking zero, some, or all of them is a fine answer.",
  },
  {
    Icon: MoveVertical,
    title: "Drag to rate",
    body: "Drag the photo onto a number to rate it. Let go anywhere else and it springs back, so a stray touch can't score it by accident.",
  },
  {
    Icon: ListOrdered,
    title: "Drag to rank",
    body: "Drag each card onto an open slot to put it in order. Hold and drag a card that's already placed to swap it with another.",
  },
];

type FirstTestWalkthroughProps = {
  /** The evaluator reached the end of every slide. */
  onComplete: () => void;
  /** The evaluator left before the last slide. */
  onSkip: () => void;
};

/**
 * A one-time, Instagram-style first-run walkthrough shown before a brand-new evaluator's
 * very first test (15.7): a short tap-through sequence covering every question type, not
 * just the two novel drag gestures `useGestureTutorial` explains mid-test.
 *
 * Tap the right half of the screen to advance, the left half to go back - the same
 * left/right split every story-style walkthrough uses, so there is nothing new to teach
 * about navigating the walkthrough itself before it starts teaching the app.
 */
export function FirstTestWalkthrough({ onComplete, onSkip }: FirstTestWalkthroughProps) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index]!;
  const isLast = index === SLIDES.length - 1;

  function advance() {
    if (isLast) {
      onComplete();
      return;
    }
    setIndex((current) => current + 1);
  }

  function retreat() {
    setIndex((current) => Math.max(0, current - 1));
  }

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
        {/* Covers the whole slide so most of the screen is a tap target, with the header
            and caption drawn on top of it (see their own `pointerEvents` below). */}
        <View style={styles.tapZones} pointerEvents="box-none">
          <Pressable
            style={styles.tapLeft}
            onPress={retreat}
            accessibilityRole="button"
            accessibilityLabel="Previous"
          />
          <Pressable
            style={styles.tapRight}
            onPress={advance}
            accessibilityRole="button"
            accessibilityLabel={isLast ? "Start" : "Next"}
          />
        </View>

        <View style={styles.header} pointerEvents="box-none">
          <View style={styles.progressRow}>
            {SLIDES.map((_, slideIndex) => (
              <View key={slideIndex} style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, slideIndex <= index && styles.progressFillDone]}
                />
              </View>
            ))}
          </View>

          <Pressable
            style={styles.skip}
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip walkthrough"
          >
            <Text style={styles.skipLabel}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.content} pointerEvents="none">
          <slide.Icon size={64} color={theme.colors.accent} strokeWidth={1.5} />
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.caption}>{slide.body}</Text>
        </View>

        <View style={styles.footer} pointerEvents="none">
          <Text style={styles.footerHint}>{isLast ? "Tap to start" : "Tap to continue"}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.colors.surfaceBase,
    zIndex: 10,
  },
  flex: { flex: 1 },
  tapZones: { ...StyleSheet.absoluteFill, flexDirection: "row" },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(1.5),
    paddingHorizontal: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
  progressRow: { flex: 1, flexDirection: "row", gap: theme.spacing(0.75) },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.borderHairline,
    overflow: "hidden",
  },
  progressFill: { flex: 1, backgroundColor: "transparent" },
  progressFillDone: { backgroundColor: theme.colors.accent },
  skip: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" },
  skipLabel: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: "600" },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(2),
    padding: theme.spacing(4),
  },
  title: { color: theme.colors.textPrimary, fontSize: 24, fontWeight: "700", textAlign: "center" },
  caption: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  footer: { alignItems: "center", paddingBottom: theme.spacing(3) },
  footerHint: { color: theme.colors.textSecondary, fontSize: 13 },
});
