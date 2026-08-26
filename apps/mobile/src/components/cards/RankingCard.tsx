import { useMemo, useState } from "react";
import { Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { DEFAULT_RANKING_BEST_LABEL, DEFAULT_RANKING_WORST_LABEL } from "@testx/shared";
import { TapZone } from "@/components/TapZone";
import { CardMedia } from "./CardMedia";
import { DragHint } from "./DragHint";
import { SwipeCard } from "./SwipeCard";
import type { ReleaseGesture } from "./SwipeCard";
import { resolveMediaUrl } from "@/lib/env";
import { triggerTargetHaptic } from "@/lib/motion";
import {
  activeTargetValue,
  orderPlacements,
  resolveDropTarget,
  targetProximity,
} from "@/lib/swipe";
import type { DropTarget } from "@/lib/swipe";
import type { EvaluatorOption, EvaluatorQuestion } from "@/lib/test";
import { useGestureTutorial } from "@/lib/tutorial";
import { theme } from "@/lib/theme";

const SLOT_WIDTH = 56;
const SLOT_HEIGHT = 48;
const SLOT_GAP = 10;
/** Gap between the photo and the answer column - real layout space, not an overlay margin. */
const COLUMN_GAP = 12;
const CARD_SLOT_INSET = 16;
const HIT_RADIUS = 52;
const PROXIMITY_FALLOFF = 170;
const MAX_SLOT_SCALE = 1.45;
/** Fixed so the label row's presence never shifts the slots' own centre. */
const END_LABEL_HEIGHT = 28;
/** Side length of the notch diamond that cuts a rank slot into a tag shape (15.2). */
const NOTCH_SIZE = 14;

type RankingCardProps = {
  question: EvaluatorQuestion;
  isActive: boolean;
  /** Option ids in placed order: index 0 is slot 1, the best. */
  onAnswer: (orderedOptionIds: string[]) => void;
};

/**
 * Ranking as drag-to-slot: the same target-column mechanics as Rating (`DropTarget`,
 * `resolveDropTarget`, `targetProximity` in swipe.ts), but every option is its own card,
 * each slot takes exactly one of them, and the slots render as notched rank tags rather
 * than Rating's pills (15.2) - a scale and a strict order should not look like the same
 * component wearing two labels.
 *

 * The prompt and the "N of M" status line are static chrome drawn by this component's own
 * outer "Card" surface; only the photo is the draggable `SwipeCard`, so a touch on either
 * text line never starts a drag. The slot column sits in its own reserved space beside the
 * photo, never on top of it.
 *
 * A filled slot stops being a drop target, which is what makes the ordering strict rather
 * than allowing ties. Aiming at a filled one springs the card back instead of snapping to
 * a neighbouring slot: landing somewhere the evaluator did not aim would quietly produce
 * an ordering they never chose, and the ordering is the entire answer here.
 *
 * Tapping a filled slot pulls its card back out (`reclaim`) so one placement can be
 * revised without discarding the rest - the outer deck's Back (10.7) is the only other
 * undo, and that throws away the whole question.
 */
export function RankingCard({ question, isActive, onAnswer }: RankingCardProps) {
  const { width } = useWindowDimensions();

  const options = question.options;
  const slotCount = options.length;
  const optionsById = useMemo(
    () => new Map(options.map((option) => [option.id, option])),
    [options]
  );

  /** Slot number (1-based) to the option id placed in it. */
  const [placements, setPlacements] = useState<Record<number, string>>({});
  /** Option ids not yet placed, in the order they're offered. Index 0 is the active card. */
  const [remaining, setRemaining] = useState<string[]>(() => options.map((option) => option.id));

  const bestLabel = question.config.bestLabel ?? DEFAULT_RANKING_BEST_LABEL;
  const worstLabel = question.config.worstLabel ?? DEFAULT_RANKING_WORST_LABEL;

  const cardWidth = width - CARD_SLOT_INSET * 2;
  const photoWidth = cardWidth - COLUMN_GAP - SLOT_WIDTH;

  // Owned here (not inside SwipeCard) because Rating/Ranking need the finger position to
  // light up the target column - see SwipeCard's `position`/`pointer` doc. That means a
  // fresh card for the next option does not automatically get a fresh 0,0: `place`/
  // `reclaim` reset these explicitly before swapping `current`.
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);

  // Same derivation as RatingCard's: the column is a plain flex sibling of the photo, so
  // a slot's offset from their shared centre follows from its index alone. Nothing is
  // measured, and there is no safe-area asymmetry to correct for now that the column is
  // real layout space rather than an inset overlay.
  const targets = useMemo<DropTarget[]>(() => {
    const step = SLOT_HEIGHT + SLOT_GAP;
    const centerX = photoWidth / 2 + COLUMN_GAP + SLOT_WIDTH / 2;

    return Array.from({ length: slotCount }, (_, index) => ({
      value: index + 1,
      centerX,
      centerY: (index - (slotCount - 1) / 2) * step,
      radius: HIT_RADIUS,
      enabled: placements[index + 1] === undefined,
    }));
  }, [photoWidth, slotCount, placements]);

  const current = remaining[0] ? optionsById.get(remaining[0]) : undefined;

  const tutorial = useGestureTutorial("ranking", isActive);
  const hintTarget = targets.find((target) => target.enabled);

  // Same tick as RatingCard's, at the same moment: when the drag crosses into an open
  // slot's commit radius, not just at release.
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
    // Hit-tested on the finger, not the card, so the slot you are pointing at is the one
    // that takes the card no matter where on the photo you picked it up.
    const target = resolveDropTarget(gesture.pointerX, gesture.pointerY, targets);
    if (!target) return { commit: false as const };
    return {
      commit: true as const,
      value: target.value,
      flyTo: { x: gesture.x, y: gesture.y },
    };
  };

  /**
   * Zeroes the shared drag/pointer offsets before the next card takes over.
   *
   * `x`/`y`/`pointerX`/`pointerY` are owned here, not by SwipeCard, so remounting the
   * SwipeCard for the next option (see the `key` below) does not by itself reset them -
   * they would otherwise still read wherever the last card was released, which on a miss
   * near a slot boundary can leave a neighbouring slot armed before the next drag begins.
   */
  function resetDrag() {
    x.value = 0;
    y.value = 0;
    pointerX.value = 0;
    pointerY.value = 0;
  }

  function place(slotNumber: number) {
    if (!current) return;
    const next = { ...placements, [slotNumber]: current.id };
    const nextRemaining = remaining.slice(1);
    resetDrag();

    if (nextRemaining.length === 0) {
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
    setRemaining(nextRemaining);
  }

  /** Pulls a filled slot's card back out to the front of the queue, for re-placing. */
  function reclaim(slotNumber: number) {
    const optionId = placements[slotNumber];
    if (optionId === undefined) return;
    const next = { ...placements };
    delete next[slotNumber];
    resetDrag();
    setPlacements(next);
    setRemaining((prev) => [optionId, ...prev]);
  }

  if (!current) {
    return (
      <View style={styles.shadow}>
        <View style={styles.card}>
          <Text style={styles.prompt}>{question.prompt}</Text>
          <Text style={styles.status}>This question has no options to rank.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shadow}>
      <View style={styles.card}>
        <Text style={styles.prompt}>{question.prompt}</Text>
        <Text style={styles.status}>
          {slotCount - remaining.length + 1} of {slotCount} · drag onto an open slot
        </Text>

        <View style={styles.row}>
          <View style={{ width: photoWidth }}>
            <SwipeCard
              // Remounts for each option in turn, matching CardStack's own unmount-to-reset
              // pattern (see that file's comment): without this the same SwipeCard instance
              // persists across placements, and its internal `isSettling` latch - set once on
              // the first commit and never cleared - permanently disables the pan gesture for
              // every option after it.
              key={current.id}
              surface={false}
              width={photoWidth}
              enabled={isActive}
              position={isActive ? { x, y } : undefined}
              pointer={isActive ? { x: pointerX, y: pointerY } : undefined}
              onRelease={onRelease}
              onCommit={place}
              onDragStart={tutorial.shouldShow ? tutorial.dismiss : undefined}
              maxTiltDeg={0}
            >
              <CardMedia
                mediaType={question.mediaType}
                url={current.mediaUrl}
                label={current.label}
                isActive={isActive}
              />
            </SwipeCard>

            {tutorial.shouldShow && hintTarget ? (
              <DragHint
                toX={hintTarget.centerX}
                toY={hintTarget.centerY}
                message="Drag each card onto an open slot. 1 is best. A filled slot will not take another."
              />
            ) : null}
          </View>

          <View style={styles.column}>
            <View style={styles.endLabelSlot}>
              <Text style={styles.endLabel} numberOfLines={1}>
                {bestLabel}
              </Text>
            </View>

            {targets.map((target) => (
              <RankSlot
                key={target.value}
                target={target}
                targets={targets}
                pointerX={pointerX}
                pointerY={pointerY}
                option={optionsById.get(placements[target.value] ?? "")}
                mediaType={question.mediaType}
                disabled={!isActive}
                onReclaim={reclaim}
                onPlace={place}
              />
            ))}

            <View style={styles.endLabelSlot}>
              <Text style={styles.endLabel} numberOfLines={1}>
                {worstLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function RankSlot({
  target,
  targets,
  pointerX,
  pointerY,
  option,
  mediaType,
  disabled,
  onReclaim,
  onPlace,
}: {
  target: DropTarget;
  targets: DropTarget[];
  pointerX: SharedValue<number>;
  pointerY: SharedValue<number>;
  option: EvaluatorOption | undefined;
  mediaType: string | null;
  disabled: boolean;
  onReclaim: (slotNumber: number) => void;
  onPlace: (slotNumber: number) => void;
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
      {/* The notch is what makes a rank slot read as a tag rather than Rating's pill: a
          diamond the same colour as the card behind it, half overlapping the slot's left
          edge so it reads as a cut corner rather than a separate shape drawn on top. It
          sits outside the slot's own `overflow: "hidden"` so the cut isn't clipped away. */}
      <View style={styles.notch} pointerEvents="none" />
      <Animated.View style={[styles.slot, filled && styles.slotFilled, animated]}>
        {filled && option ? (
          <TapZone
            style={styles.slotThumbnailPressable}
            disabled={disabled}
            onPress={() => onReclaim(target.value)}
            accessibilityLabel={`Remove ${option.label ?? "this card"} from rank ${target.value}, to place it again`}
          >
            <SlotThumbnail option={option} mediaType={mediaType} />
          </TapZone>
        ) : (
          // Tap-based fallback for the drag-to-slot gesture (prd.md §16.7): places the
          // current card here directly, same as dragging it onto this slot would.
          <TapZone
            style={styles.slotThumbnailPressable}
            disabled={disabled}
            onPress={() => onPlace(target.value)}
            accessibilityLabel={`Place the current card at rank ${target.value}`}
          >
            <Text style={styles.slotText}>{target.value}</Text>
          </TapZone>
        )}
      </Animated.View>
    </View>
  );
}

/** A placed option's photo, small enough to fit in a slot - lets the evaluator see the
 * whole ranking at a glance instead of just slot numbers. Falls back to an initial for
 * non-image media, same as CardMedia's own TEXT fallback but sized for the slot. */
function SlotThumbnail({ option, mediaType }: { option: EvaluatorOption; mediaType: string | null }) {
  const resolved = mediaType === "IMAGE" ? resolveMediaUrl(option.mediaUrl) : null;
  if (!resolved) {
    return (
      <Text style={styles.slotTextFilled} numberOfLines={1}>
        {(option.label ?? "?").charAt(0).toUpperCase()}
      </Text>
    );
  }
  return <Image source={{ uri: resolved }} style={styles.slotThumbnail} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  shadow: { flex: 1, ...theme.card.shadow },
  card: { ...theme.card.surface },
  prompt: {
    color: theme.colors.textPrimary,
    ...theme.type.prompt,
    paddingHorizontal: theme.spacing(2),
    paddingTop: theme.spacing(2),
  },
  status: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    paddingHorizontal: theme.spacing(2),
    paddingBottom: theme.spacing(1),
  },
  row: {
    flex: 1,
    flexDirection: "row",
    gap: COLUMN_GAP,
    paddingHorizontal: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
  column: {
    width: SLOT_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: SLOT_GAP,
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
  slotWrap: {
    width: SLOT_WIDTH,
    height: SLOT_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  // A tag, not a pill (15.2): a squarer rect than Rating's capsule, with a corner cut by
  // `notch` below - a shape that reads as "strict order", never as "this is a score".
  slot: {
    width: SLOT_WIDTH,
    height: SLOT_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "dashed",
    // Target pill at rest, per prd.md §16.6 - matches RatingCard's pill.
    backgroundColor: theme.colors.surfaceOverlay,
    overflow: "hidden",
  },
  // Sits outside `slot`'s clip, centred on its left edge, coloured to match the card
  // surface behind it - so it reads as a bite taken out of the slot's corner.
  notch: {
    position: "absolute",
    left: -NOTCH_SIZE / 2,
    top: "50%",
    marginTop: -NOTCH_SIZE / 2,
    width: NOTCH_SIZE,
    height: NOTCH_SIZE,
    backgroundColor: theme.colors.surfaceRaised,
    transform: [{ rotate: "45deg" }],
  },
  slotFilled: {
    borderStyle: "solid",
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  slotText: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700" },
  slotTextFilled: { color: theme.colors.accentContrast, fontSize: 18, fontWeight: "700" },
  slotThumbnailPressable: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  slotThumbnail: { width: "100%", height: "100%" },
});
