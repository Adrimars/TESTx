import { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { DEFAULT_RATING_MAX_LABEL, DEFAULT_RATING_MIN_LABEL } from "@testx/shared";
import { TapZone } from "@/components/TapZone";
import { CardMedia } from "./CardMedia";
import { DragHint } from "./DragHint";
import { SwipeCard } from "./SwipeCard";
import type { ReleaseGesture } from "./SwipeCard";
import { triggerTargetHaptic } from "@/lib/motion";
import { activeTargetValue, resolveDropTarget, targetProximity } from "@/lib/swipe";
import type { DropTarget } from "@/lib/swipe";
import type { EvaluatorQuestion } from "@/lib/test";
import { useGestureTutorial } from "@/lib/tutorial";
import { theme } from "@/lib/theme";

const PILL_WIDTH = 56;
const PILL_HEIGHT = 48;
const PILL_GAP = 10;
/** Gap between the photo and the answer column - real layout space, not an overlay margin. */
const COLUMN_GAP = 12;
/** CardStack insets each card slot by this much; the card is that much narrower. */
const CARD_SLOT_INSET = 16;
/** Horizontal padding on the photo+column row - has to come out of photoWidth's own
 * derivation below, or the row's flex children get compressed to fit the padded space
 * while the hit-test math keeps assuming the uncompressed width. */
const ROW_PADDING = theme.spacing(2);
/** How far from a pill's centre a release still counts as landing on it. */
const HIT_RADIUS = 52;
/** Distance over which a pill grows as the card approaches. */
const PROXIMITY_FALLOFF = 170;
const MAX_PILL_SCALE = 1.45;
/** Fixed so the label row's presence/absence never shifts the pills' own centre. */
const END_LABEL_HEIGHT = 28;

type RatingCardProps = {
  question: EvaluatorQuestion;
  isActive: boolean;
  onAnswer: (ratingValue: number) => void;
};

/**
 * Rating as drag-to-target: a column of pills beside the photo, dragged onto rather than
 * tapped. Releasing anywhere else springs the card back uncommitted, so an accidental
 * nudge cannot score a question.
 *
 * Stays low-to-high, top-to-bottom always (15.3) - unlike Ranking, a rating has no
 * best/worst end to flip toward, so the column's direction never changes. What can be
 * missing is which end means "better": the end labels default to "Low"/"High" whenever
 * the admin didn't set `minLabel`/`maxLabel`, so the direction is never left ambiguous.
 *
 * The prompt and the pill column are static chrome drawn by this component's own outer
 * "Card" surface; only the photo is the draggable `SwipeCard`, so a touch on the prompt
 * text never starts a drag. The column sits in its own reserved space beside the photo,
 * never on top of it - see swipe.ts's DropTarget doc for why the column's own centreY has
 * to keep matching where it's actually rendered.
 */
export function RatingCard({ question, isActive, onAnswer }: RatingCardProps) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);

  const min = question.config.min ?? 1;
  const max = question.config.max ?? 5;

  const values = useMemo(() => {
    const out: number[] = [];
    for (let v = min; v <= max; v += 1) out.push(v);
    return out;
  }, [min, max]);

  const cardWidth = width - CARD_SLOT_INSET * 2;
  const photoWidth = cardWidth - ROW_PADDING * 2 - COLUMN_GAP - PILL_WIDTH;

  /**
   * Pill centres as offsets from the photo's own centre - `SwipeCard`'s gesture math
   * grabs and tracks the finger relative to its own measured box (see `ReleaseGesture`'s
   * doc), and once the photo is that box, this is the space its targets have to live in.
   *
   * These are derived from the layout constants rather than measured, so the targets
   * exist on the very first render and the first drag of a card is live rather than
   * inert. The column is a plain flex sibling of the photo now, not an inset overlay, so
   * there is no safe-area asymmetry to correct for: both sit inside the same row, and a
   * pill's vertical offset from that shared centre follows from its index alone.
   */
  const targets = useMemo<DropTarget[]>(() => {
    const count = values.length;
    const step = PILL_HEIGHT + PILL_GAP;
    const centerX = photoWidth / 2 + COLUMN_GAP + PILL_WIDTH / 2;

    return values.map((value, index) => ({
      value,
      centerX,
      centerY: (index - (count - 1) / 2) * step,
      radius: HIT_RADIUS,
      enabled: true,
    }));
  }, [values, photoWidth]);

  // Only the active card may teach; a peeking card is not being interacted with, and two
  // hints on screen at once would be worse than none.
  const tutorial = useGestureTutorial("rating", isActive);
  const hintTarget = targets[Math.floor(targets.length / 2)];

  // A light tick the moment the drag crosses into a new pill's commit radius (prd.md
  // §16.4), not just on release - `activeTargetValue` is the same "which pill is armed"
  // read TargetPill's own scale animation uses, so the tick and the visual arming can
  // never disagree about which pill is about to commit.
  useAnimatedReaction(
    () => (isActive ? activeTargetValue(pointerX.value, pointerY.value, targets) : 0),
    (armed, previouslyArmed) => {
      if (armed !== 0 && armed !== previouslyArmed) {
        runOnJS(triggerTargetHaptic)();
      }
    },
    [isActive, targets]
  );

  const onRelease = (gesture: ReleaseGesture) => {
    "worklet";
    // Hit-tested on the finger, not the card, so the pill you are pointing at is the one
    // that commits regardless of where on the photo you picked it up.
    const target = resolveDropTarget(gesture.pointerX, gesture.pointerY, targets);
    if (!target) return { commit: false as const };
    return {
      commit: true as const,
      value: target.value,
      // Fly to where the finger let go rather than to the pill's centre, so the photo
      // leaves from under the finger instead of jumping sideways first.
      flyTo: { x: gesture.x, y: gesture.y },
    };
  };

  return (
    <View style={styles.shadow}>
      <View style={styles.card}>
        <Text style={styles.prompt}>{question.prompt}</Text>

        <View style={styles.row}>
          <View style={{ width: photoWidth }}>
            <SwipeCard
              surface={false}
              width={photoWidth}
              enabled={isActive}
              position={isActive ? { x, y } : undefined}
              pointer={isActive ? { x: pointerX, y: pointerY } : undefined}
              onRelease={onRelease}
              onCommit={onAnswer}
              onDragStart={tutorial.shouldShow ? tutorial.dismiss : undefined}
              maxTiltDeg={0}
            >
              <CardMedia
                mediaType={question.mediaType}
                url={question.options[0]?.mediaUrl ?? null}
                label={question.options[0]?.label ?? null}
                isActive={isActive}
              />
            </SwipeCard>

            {tutorial.shouldShow && hintTarget ? (
              <DragHint
                toX={hintTarget.centerX}
                toY={hintTarget.centerY}
                message="Drag the card onto a number to rate it. Let go anywhere else to start over."
              />
            ) : null}
          </View>

          <View style={styles.column}>
            <View style={styles.endLabelSlot}>
              <Text style={styles.endLabel} numberOfLines={1}>
                {question.config.minLabel ?? DEFAULT_RATING_MIN_LABEL}
              </Text>
            </View>

            {targets.map((target) => (
              <TargetPill
                key={target.value}
                target={target}
                label={String(target.value)}
                targets={targets}
                pointerX={pointerX}
                pointerY={pointerY}
                disabled={!isActive}
                onPress={() => onAnswer(target.value)}
              />
            ))}

            <View style={styles.endLabelSlot}>
              <Text style={styles.endLabel} numberOfLines={1}>
                {question.config.maxLabel ?? DEFAULT_RATING_MAX_LABEL}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.hint}>Drag onto a number to rate</Text>
      </View>
    </View>
  );
}

function TargetPill({
  target,
  label,
  targets,
  pointerX,
  pointerY,
  disabled,
  onPress,
}: {
  target: DropTarget;
  label: string;
  targets: DropTarget[];
  pointerX: SharedValue<number>;
  pointerY: SharedValue<number>;
  disabled: boolean;
  onPress: () => void;
}) {
  const animated = useAnimatedStyle(() => {
    // Exactly one pill can be active, because only one target can be under the finger.
    // Scaling every pill the finger happens to be near reads as several values being
    // selected at once, which is the opposite of what a 1-to-5 rating means.
    const isActive = activeTargetValue(pointerX.value, pointerY.value, targets) === target.value;
    if (!isActive) {
      return { transform: [{ scale: 1 }], borderColor: theme.colors.borderHairline, opacity: 1 };
    }
    const nearness = targetProximity(pointerX.value, pointerY.value, target, PROXIMITY_FALLOFF);
    return {
      transform: [{ scale: 1 + nearness * (MAX_PILL_SCALE - 1) }],
      borderColor: theme.colors.accent,
      opacity: 1,
    };
  });

  const fill = useAnimatedStyle(() => ({
    opacity:
      activeTargetValue(pointerX.value, pointerY.value, targets) === target.value ? 1 : 0,
  }));

  return (
    <View style={styles.pillSlot}>
      <Animated.View style={[styles.pill, animated]}>
        <Animated.View style={[styles.pillFill, fill]} />
        <TapZone
          style={styles.pillPressable}
          disabled={disabled}
          onPress={onPress}
          accessibilityLabel={`Rate ${label}`}
        >
          <Text style={styles.pillText}>{label}</Text>
        </TapZone>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { flex: 1, ...theme.card.shadow },
  card: { ...theme.card.surface },
  prompt: {
    color: theme.colors.textPrimary,
    ...theme.type.prompt,
    padding: theme.spacing(2),
  },
  row: {
    flex: 1,
    flexDirection: "row",
    gap: COLUMN_GAP,
    paddingHorizontal: ROW_PADDING,
  },
  hint: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    padding: theme.spacing(1.5),
  },
  column: {
    width: PILL_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: PILL_GAP,
  },
  endLabelSlot: {
    height: END_LABEL_HEIGHT,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  endLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    textAlign: "center",
  },
  pillSlot: { alignItems: "center", justifyContent: "center", height: PILL_HEIGHT },
  pill: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 2,
    // Target pill at rest, per prd.md §16.6.
    backgroundColor: theme.colors.surfaceOverlay,
    overflow: "hidden",
  },
  // Sits under the number so the active pill reads as filled rather than merely outlined.
  pillFill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.colors.accent,
  },
  pillText: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" },
  pillPressable: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
