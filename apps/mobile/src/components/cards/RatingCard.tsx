import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
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
const COLUMN_RIGHT_MARGIN = 12;
/** CardStack insets each card slot by this much; the card is that much narrower. */
const CARD_SLOT_INSET = 16;
/** How far from a pill's centre a release still counts as landing on it. */
const HIT_RADIUS = 52;
/** Distance over which a pill grows as the card approaches. */
const PROXIMITY_FALLOFF = 170;
const MAX_PILL_SCALE = 1.45;

type RatingCardProps = {
  question: EvaluatorQuestion;
  isActive: boolean;
  onAnswer: (ratingValue: number) => void;
};

/**
 * Rating as drag-to-target: a column of pills down the right edge, dragged onto rather
 * than tapped. Releasing anywhere else springs the card back uncommitted, so an
 * accidental nudge cannot score a question.
 *
 * The column is laid out inside the safe area rather than against the raw screen edge.
 * At the extremes it would otherwise sit under the notch or the home indicator on iOS and
 * under the gesture bar on Android - and those extremes are 1 and 5, the two values an
 * evaluator reaches for most.
 */
export function RatingCard({ question, isActive, onAnswer }: RatingCardProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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

  /**
   * Pill centres as offsets from the card's resting centre - the same space the drag
   * translation lives in.
   *
   * These are derived from the layout constants rather than measured. The column is
   * centred between the safe-area insets, so a pill's offset from centre is fixed by its
   * index, and mirroring that arithmetic here is exact where a measurement would be one
   * frame late. It also means the targets exist on the very first render, so the first
   * drag of a card is live rather than inert.
   */
  const targets = useMemo<DropTarget[]>(() => {
    const count = values.length;
    const step = PILL_HEIGHT + PILL_GAP;
    // justifyContent:"center" between top:insets.top and bottom:insets.bottom puts the
    // column's midpoint this far off the card's midpoint.
    const columnShift = (insets.top - insets.bottom) / 2;
    const cardWidth = width - CARD_SLOT_INSET * 2;
    const centerX = cardWidth / 2 - insets.right - COLUMN_RIGHT_MARGIN - PILL_WIDTH / 2;

    return values.map((value, index) => ({
      value,
      centerX,
      centerY: columnShift + (index - (count - 1) / 2) * step,
      radius: HIT_RADIUS,
      enabled: true,
    }));
  }, [insets.top, insets.bottom, insets.right, values, width]);

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
    // that commits regardless of where on the card you picked it up.
    const target = resolveDropTarget(gesture.pointerX, gesture.pointerY, targets);
    if (!target) return { commit: false as const };
    return {
      commit: true as const,
      value: target.value,
      // Fly to where the finger let go rather than to the pill's centre, so the card
      // leaves from under the finger instead of jumping sideways first.
      flyTo: { x: gesture.x, y: gesture.y },
    };
  };

  return (
    <View style={styles.wrapper}>
      <SwipeCard
        width={width}
        enabled={isActive}
        position={isActive ? { x, y } : undefined}
        pointer={isActive ? { x: pointerX, y: pointerY } : undefined}
        onRelease={onRelease}
        onCommit={onAnswer}
        onDragStart={tutorial.shouldShow ? tutorial.dismiss : undefined}
        maxTiltDeg={0}
      >
        <View style={styles.body}>
          <Text style={styles.prompt}>{question.prompt}</Text>
          <View style={styles.media}>
            <CardMedia
              mediaType={question.mediaType}
              url={question.options[0]?.mediaUrl ?? null}
              label={question.options[0]?.label ?? null}
              isActive={isActive}
            />
          </View>
          <Text style={styles.hint}>Drag onto a number to rate</Text>
        </View>
      </SwipeCard>

      {tutorial.shouldShow && hintTarget ? (
        <DragHint
          toX={hintTarget.centerX}
          toY={hintTarget.centerY}
          message="Drag the card onto a number to rate it. Let go anywhere else to start over."
        />
      ) : null}

      <View
        style={[
          styles.column,
          { right: insets.right + COLUMN_RIGHT_MARGIN, top: insets.top, bottom: insets.bottom },
        ]}
        // "box-none": the column stays inert for the drag gesture beneath it, but each
        // pill's own Pressable can still take a direct tap - the tap-based fallback every
        // gesture-driven interaction needs (prd.md §16.7).
        pointerEvents="box-none"
      >
        {targets.map((target, index) => (
          <TargetPill
            key={target.value}
            target={target}
            label={String(target.value)}
            endLabel={
              index === 0 ? question.config.minLabel : index === targets.length - 1 ? question.config.maxLabel : undefined
            }
            targets={targets}
            pointerX={pointerX}
            pointerY={pointerY}
            disabled={!isActive}
            onPress={() => onAnswer(target.value)}
          />
        ))}
      </View>
    </View>
  );
}

function TargetPill({
  target,
  label,
  endLabel,
  targets,
  pointerX,
  pointerY,
  disabled,
  onPress,
}: {
  target: DropTarget;
  label: string;
  endLabel?: string;
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
      {endLabel ? <Text style={styles.endLabel} numberOfLines={1}>{endLabel}</Text> : null}
      <Animated.View style={[styles.pill, animated]}>
        <Animated.View style={[styles.pillFill, fill]} />
        <Pressable
          style={styles.pillPressable}
          disabled={disabled}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Rate ${label}`}
        >
          <Text style={styles.pillText}>{label}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  body: { flex: 1 },
  prompt: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 24,
    padding: theme.spacing(2),
    // Keep the prompt clear of the target column so long prompts do not run under it.
    paddingRight: PILL_WIDTH + COLUMN_RIGHT_MARGIN + theme.spacing(2),
  },
  media: { flex: 1 },
  hint: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    padding: theme.spacing(1.5),
  },
  column: {
    position: "absolute",
    width: PILL_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: PILL_GAP,
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
  endLabel: {
    position: "absolute",
    right: PILL_WIDTH + theme.spacing(0.5),
    color: theme.colors.textSecondary,
    fontSize: 11,
    width: 90,
    textAlign: "right",
  },
});
