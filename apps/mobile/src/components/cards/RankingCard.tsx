import { useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { DEFAULT_RANKING_BEST_LABEL, DEFAULT_RANKING_WORST_LABEL } from "@testx/shared";
import { CardMedia } from "./CardMedia";
import { DragHint } from "./DragHint";
import { SwipeCard } from "./SwipeCard";
import type { ReleaseGesture } from "./SwipeCard";
import {
  activeTargetValue,
  orderPlacements,
  resolveDropTarget,
  targetProximity,
} from "@/lib/swipe";
import type { DropTarget } from "@/lib/swipe";
import type { EvaluatorQuestion } from "@/lib/test";
import { useGestureTutorial } from "@/lib/tutorial";
import { theme } from "@/lib/theme";

const SLOT_WIDTH = 56;
const SLOT_HEIGHT = 48;
const SLOT_GAP = 10;
const COLUMN_RIGHT_MARGIN = 12;
const CARD_SLOT_INSET = 16;
const HIT_RADIUS = 52;
const PROXIMITY_FALLOFF = 170;
const MAX_SLOT_SCALE = 1.45;

type RankingCardProps = {
  question: EvaluatorQuestion;
  isActive: boolean;
  /** Option ids in placed order: index 0 is slot 1, the best. */
  onAnswer: (orderedOptionIds: string[]) => void;
};

/**
 * Ranking as drag-to-slot: the same target column as Rating, but every option is its own
 * card and each slot takes exactly one of them.
 *
 * A filled slot stops being a drop target, which is what makes the ordering strict rather
 * than allowing ties. Aiming at a filled one springs the card back instead of snapping to
 * a neighbouring slot: landing somewhere the evaluator did not aim would quietly produce
 * an ordering they never chose, and the ordering is the entire answer here.
 */
export function RankingCard({ question, isActive, onAnswer }: RankingCardProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const options = question.options;
  const slotCount = options.length;

  /** Slot number (1-based) to the option id placed in it. */
  const [placements, setPlacements] = useState<Record<number, string>>({});
  const [cursor, setCursor] = useState(0);

  const bestLabel = question.config.bestLabel ?? DEFAULT_RANKING_BEST_LABEL;
  const worstLabel = question.config.worstLabel ?? DEFAULT_RANKING_WORST_LABEL;

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);

  // Same derivation as RatingCard: the column is centred between the safe-area insets, so
  // each slot offset from the card centre follows from its index. Nothing is measured.
  const targets = useMemo<DropTarget[]>(() => {
    const step = SLOT_HEIGHT + SLOT_GAP;
    const columnShift = (insets.top - insets.bottom) / 2;
    const cardWidth = width - CARD_SLOT_INSET * 2;
    const centerX = cardWidth / 2 - insets.right - COLUMN_RIGHT_MARGIN - SLOT_WIDTH / 2;

    return Array.from({ length: slotCount }, (_, index) => ({
      value: index + 1,
      centerX,
      centerY: columnShift + (index - (slotCount - 1) / 2) * step,
      radius: HIT_RADIUS,
      enabled: placements[index + 1] === undefined,
    }));
  }, [insets.top, insets.bottom, insets.right, width, slotCount, placements]);

  const current = options[cursor];

  const tutorial = useGestureTutorial("ranking", isActive);
  const hintTarget = targets.find((target) => target.enabled);

  const onRelease = (gesture: ReleaseGesture) => {
    "worklet";
    // Hit-tested on the finger, not the card, so the slot you are pointing at is the one
    // that takes the card no matter where you picked it up.
    const target = resolveDropTarget(gesture.pointerX, gesture.pointerY, targets);
    if (!target) return { commit: false as const };
    return {
      commit: true as const,
      value: target.value,
      flyTo: { x: gesture.x, y: gesture.y },
    };
  };

  function place(slotNumber: number) {
    if (!current) return;
    const next = { ...placements, [slotNumber]: current.id };
    const nextCursor = cursor + 1;

    if (nextCursor >= options.length) {
      const ordered = orderPlacements(next, slotCount);
      // Every card has been placed and every slot takes exactly one, so this cannot come
      // back null. Falling through rather than asserting keeps a partial ranking out of
      // the submission if that ever stops being true.
      if (ordered) {
        onAnswer(ordered);
        return;
      }
    }

    setPlacements(next);
    setCursor(nextCursor);
  }

  if (!current) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.prompt}>{question.prompt}</Text>
        <Text style={styles.status}>This question has no options to rank.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <SwipeCard
        width={width}
        enabled={isActive}
        position={isActive ? { x, y } : undefined}
        pointer={isActive ? { x: pointerX, y: pointerY } : undefined}
        onRelease={onRelease}
        onCommit={place}
        onDragStart={tutorial.shouldShow ? tutorial.dismiss : undefined}
        maxTiltDeg={0}
      >
        <View style={styles.body}>
          <Text style={styles.prompt}>{question.prompt}</Text>
          <Text style={styles.status}>
            {cursor + 1} of {options.length} · drag onto an open slot
          </Text>
          <View style={styles.media}>
            <CardMedia
              mediaType={question.mediaType}
              url={current.mediaUrl}
              label={current.label}
              isActive={isActive}
            />
          </View>
        </View>
      </SwipeCard>

      {tutorial.shouldShow && hintTarget ? (
        <DragHint
          toX={hintTarget.centerX}
          toY={hintTarget.centerY}
          message="Drag each card onto an open slot. 1 is best. A filled slot will not take another."
        />
      ) : null}

      <View
        style={[
          styles.column,
          { right: insets.right + COLUMN_RIGHT_MARGIN, top: insets.top, bottom: insets.bottom },
          NO_TOUCH,
        ]}
      >
        {targets.map((target, index) => (
          <RankSlot
            key={target.value}
            target={target}
            endLabel={
              index === 0 ? bestLabel : index === targets.length - 1 ? worstLabel : undefined
            }
            targets={targets}
            pointerX={pointerX}
            pointerY={pointerY}
          />
        ))}
      </View>
    </View>
  );
}

function RankSlot({
  target,
  endLabel,
  targets,
  pointerX,
  pointerY,
}: {
  target: DropTarget;
  endLabel?: string;
  targets: DropTarget[];
  pointerX: SharedValue<number>;
  pointerY: SharedValue<number>;
}) {
  const filled = !target.enabled;

  const animated = useAnimatedStyle(() => {
    // Only the slot under the finger reacts. Lighting up every nearby slot would suggest
    // the card could land in any of them, when exactly one will take it.
    const isUnderFinger =
      activeTargetValue(pointerX.value, pointerY.value, targets) === target.value;
    if (!isUnderFinger) {
      return { transform: [{ scale: 1 }], borderColor: theme.colors.borderHairline };
    }
    const nearness = targetProximity(pointerX.value, pointerY.value, target, PROXIMITY_FALLOFF);
    return {
      transform: [{ scale: 1 + nearness * (MAX_SLOT_SCALE - 1) }],
      borderColor: theme.colors.accent,
    };
  });

  return (
    <View style={styles.slotWrap}>
      {endLabel ? (
        <Text style={styles.endLabel} numberOfLines={1}>
          {endLabel}
        </Text>
      ) : null}
      <Animated.View style={[styles.slot, filled && styles.slotFilled, animated]}>
        <Text style={[styles.slotText, filled && styles.slotTextFilled]}>{target.value}</Text>
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
    paddingHorizontal: theme.spacing(2),
    paddingTop: theme.spacing(2),
    // Keep the prompt clear of the slot column so long prompts do not run under it.
    paddingRight: SLOT_WIDTH + COLUMN_RIGHT_MARGIN + theme.spacing(2),
  },
  status: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    paddingHorizontal: theme.spacing(2),
    paddingBottom: theme.spacing(1),
  },
  media: { flex: 1 },
  column: {
    position: "absolute",
    width: SLOT_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: SLOT_GAP,
  },
  slotWrap: { alignItems: "center", justifyContent: "center", height: SLOT_HEIGHT },
  slot: {
    width: SLOT_WIDTH,
    height: SLOT_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    backgroundColor: theme.colors.surfaceRaised,
  },
  slotFilled: {
    borderStyle: "solid",
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  slotText: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" },
  slotTextFilled: { color: theme.colors.accentContrast },
  endLabel: {
    position: "absolute",
    right: SLOT_WIDTH + theme.spacing(0.5),
    color: theme.colors.textSecondary,
    fontSize: 11,
    width: 90,
    textAlign: "right",
  },
});
