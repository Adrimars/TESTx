import { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { CardMedia } from "./CardMedia";
import { SwipeCard } from "./SwipeCard";
import type { ReleaseGesture } from "./SwipeCard";
import { resolveDropTarget, targetProximity } from "@/lib/swipe";
import type { DropTarget } from "@/lib/swipe";
import type { EvaluatorQuestion } from "@/lib/test";
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

  const onRelease = (gesture: ReleaseGesture) => {
    "worklet";
    const target = resolveDropTarget(gesture.x, gesture.y, targets);
    if (!target) return { commit: false as const };
    return {
      commit: true as const,
      value: target.value,
      flyTo: { x: target.centerX, y: target.centerY },
    };
  };

  return (
    <View style={styles.wrapper}>
      <SwipeCard
        width={width}
        enabled={isActive}
        position={isActive ? { x, y } : undefined}
        onRelease={onRelease}
        onCommit={onAnswer}
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

      <View
        style={[
          styles.column,
          { right: insets.right + COLUMN_RIGHT_MARGIN, top: insets.top, bottom: insets.bottom },
          NO_TOUCH,
        ]}
      >
        {targets.map((target, index) => (
          <TargetPill
            key={target.value}
            target={target}
            label={String(target.value)}
            endLabel={
              index === 0 ? question.config.minLabel : index === targets.length - 1 ? question.config.maxLabel : undefined
            }
            dragX={x}
            dragY={y}
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
  dragX,
  dragY,
}: {
  target: DropTarget;
  label: string;
  endLabel?: string;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
}) {
  const animated = useAnimatedStyle(() => {
    const nearness = targetProximity(dragX.value, dragY.value, target, PROXIMITY_FALLOFF);
    return {
      transform: [{ scale: 1 + nearness * (MAX_PILL_SCALE - 1) }],
      borderColor: nearness > 0.6 ? theme.colors.accent : theme.colors.borderHairline,
      opacity: 0.85 + nearness * 0.15,
    };
  });

  return (
    <View style={styles.pillSlot}>
      {endLabel ? <Text style={styles.endLabel} numberOfLines={1}>{endLabel}</Text> : null}
      <Animated.View style={[styles.pill, animated]}>
        <Text style={styles.pillText}>{label}</Text>
      </Animated.View>
    </View>
  );
}

/** Inert overlay: the deprecated pointerEvents prop moved onto style. */
const NO_TOUCH = { pointerEvents: "none" } as const;

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
    backgroundColor: theme.colors.surfaceRaised,
  },
  pillText: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" },
  endLabel: {
    position: "absolute",
    right: PILL_WIDTH + theme.spacing(0.5),
    color: theme.colors.textSecondary,
    fontSize: 11,
    width: 90,
    textAlign: "right",
  },
});
