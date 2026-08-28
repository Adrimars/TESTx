import { useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { DEFAULT_RANKING_BEST_LABEL, DEFAULT_RANKING_WORST_LABEL } from "@testx/shared";
import { TapZone } from "@/components/TapZone";
import { CardMedia } from "./CardMedia";
import { DragHint } from "./DragHint";
import { SwipeCard } from "./SwipeCard";
import type { ReleaseGesture } from "./SwipeCard";
import { resolveMediaUrl } from "@/lib/env";
import {
  CARD_ENTRANCE_SPRING,
  CARD_REJECT_SPRING,
  REDUCED_MOTION_FADE_MS,
  triggerTargetHaptic,
} from "@/lib/motion";
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
/** Horizontal padding on the photo+column row - has to come out of photoWidth's own
 * derivation below, or the row's flex children get compressed to fit the padded space
 * while the hit-test math keeps assuming the uncompressed width. */
const ROW_PADDING = theme.spacing(2);
const HIT_RADIUS = 52;
const PROXIMITY_FALLOFF = 170;
const MAX_SLOT_SCALE = 1.45;
/** Fixed so the label row's presence never shifts the slots' own centre. */
const END_LABEL_HEIGHT = 28;
/** Side length of the notch diamond that cuts a rank slot into a tag shape (15.2). */
const NOTCH_SIZE = 14;
/** How long a placed card's thumbnail must be held before it starts dragging for a swap
 * (15.6), rather than being read as the start of a tap-to-reclaim. */
const SWAP_LONG_PRESS_MS = 350;
/** Reclaim/place entrance starting points (16.9): both ease to resting scale (1) and
 * opacity (1) rather than snapping there, growing up from a smaller state on reclaim and
 * shrinking down from a larger one on place - opposite directions, since one is a card
 * becoming "the" card and the other is a card shrinking into a slot. */
const RECLAIM_ENTRANCE_START_SCALE = 0.92;
const PLACE_ENTRANCE_START_SCALE = 1.15;
const ENTRANCE_START_OPACITY = 0.4;

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
 * The column reads best-to-worst bottom-to-top (15.3): slot 1 sits at the bottom, the
 * last slot at the top - the opposite of Rating's low-to-high top-to-bottom order, since
 * a ranking's "best" is a podium position, not a point on a scale.
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
  const photoWidth = cardWidth - ROW_PADDING * 2 - COLUMN_GAP - SLOT_WIDTH;

  // Owned here (not inside SwipeCard) because Rating/Ranking need the finger position to
  // light up the target column - see SwipeCard's `position`/`pointer` doc. That means a
  // fresh card for the next option does not automatically get a fresh 0,0: `place`/
  // `reclaim` reset these explicitly before swapping `current`.
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);

  // Driven by whichever SwappableThumbnail is mid-drag (16.1): the slot value it is
  // currently crossing (0 = none/own slot) and how close it sits to that slot's centre.
  // Lives here rather than on the thumbnail itself so a sibling RankSlot can read it too -
  // the held card and the slot it is passing over grow in lockstep off one shared number.
  const swapTargetValue = useSharedValue(0);
  const swapNearness = useSharedValue(0);

  // Reclaim entrance (16.9): the current card grows up from a smaller, more-transparent
  // state whenever `current` itself changes - both on a genuine reclaim (a different
  // option jumps back to the front of `remaining`) and on the ordinary place-to-next-
  // option advance, since both are "a new card just became current" the same way.
  const reducedMotion = useReducedMotion();
  const cardEntranceScale = useSharedValue(1);
  const cardEntranceOpacity = useSharedValue(1);

  // Same derivation as RatingCard's, except Ranking's column is flipped (15.3): slot 1
  // (best) sits at the bottom and the last slot (worst) at the top, the opposite of
  // Rating's low-to-high top-to-bottom order - a ranking's "best" belongs at the bottom
  // the way a podium reads, not stacked the way a numeric scale does. Negating the offset
  // here is only half of the flip: the render order below has to reverse too, or the
  // visual position and this hit-test geometry disagree about which slot is which.
  // Where the slots are is fixed by the column's size; only whether one is still open
  // depends on what has been placed. Keeping the two apart means a placement no longer
  // recomputes coordinates that cannot have changed. The outer array is still rebuilt -
  // `enabled` genuinely differs - but the geometry underneath it is computed once.
  const targetGeometry = useMemo(() => {
    const step = SLOT_HEIGHT + SLOT_GAP;
    const centerX = photoWidth / 2 + COLUMN_GAP + SLOT_WIDTH / 2;

    return Array.from({ length: slotCount }, (_, index) => ({
      value: index + 1,
      centerX,
      centerY: -(index - (slotCount - 1) / 2) * step,
      radius: HIT_RADIUS,
    }));
  }, [photoWidth, slotCount]);

  const targets = useMemo<DropTarget[]>(
    () =>
      targetGeometry.map((target) => ({
        ...target,
        enabled: placements[target.value] === undefined,
      })),
    [targetGeometry, placements]
  );

  const current = remaining[0] ? optionsById.get(remaining[0]) : undefined;
  const currentId = current?.id;

  // The very first card's own entrance is CardStack's job (16.2, peeking to active) - this
  // effect only animates *later* changes to `current`, i.e. an actual reclaim or a place-
  // to-next-option advance, so the two entrances never stack on the opening card.
  const isFirstCard = useRef(true);

  useEffect(() => {
    if (!currentId) return;
    if (isFirstCard.current) {
      isFirstCard.current = false;
      return;
    }
    if (reducedMotion) {
      cardEntranceScale.value = 1;
      cardEntranceOpacity.value = ENTRANCE_START_OPACITY;
      cardEntranceOpacity.value = withTiming(1, { duration: REDUCED_MOTION_FADE_MS });
      return;
    }
    cardEntranceScale.value = RECLAIM_ENTRANCE_START_SCALE;
    cardEntranceScale.value = withSpring(1, CARD_ENTRANCE_SPRING);
    cardEntranceOpacity.value = ENTRANCE_START_OPACITY;
    cardEntranceOpacity.value = withSpring(1, CARD_ENTRANCE_SPRING);
  }, [currentId, reducedMotion, cardEntranceScale, cardEntranceOpacity]);

  const cardEntranceStyle = useAnimatedStyle(() => ({
    opacity: cardEntranceOpacity.value,
    transform: [{ scale: cardEntranceScale.value }],
  }));

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

  /**
   * Swaps two already-placed cards directly (15.6): a shortcut alongside reclaim-then-
   * place, not instead of it. Holding a filled slot's thumbnail and dragging it onto
   * another filled slot moves both cards to each other's spot in one motion, with no
   * intermediate "current" card and no touch to `remaining` - reclaim-then-place and
   * hold-and-swap both only ever produce a `placements` map, never a different shape.
   *
   * `rawTargetValue` arrives unclamped, and possibly pointing at an empty slot, straight
   * from the gesture's raw translation - both are legal outcomes of a real drag (overshoot
   * past an end slot, or a slot that happens to be open), and both are simply not a swap.
   */
  function swap(sourceValue: number, rawTargetValue: number) {
    const targetValue = Math.max(1, Math.min(slotCount, rawTargetValue));
    if (targetValue === sourceValue) return;
    const sourceOptionId = placements[sourceValue];
    const targetOptionId = placements[targetValue];
    if (sourceOptionId === undefined || targetOptionId === undefined) return;
    setPlacements((prev) => ({ ...prev, [sourceValue]: targetOptionId, [targetValue]: sourceOptionId }));
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
            {/* flex:1 preserves SwipeCard's own flex-fill sizing chain (it fills this
                wrapper the same way it used to fill this View directly) - the wrapper
                only adds the reclaim entrance's scale+opacity as a paint-time effect
                (16.9), never touching layout. */}
            <Animated.View style={[styles.currentCardEntrance, cardEntranceStyle]}>
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
            </Animated.View>

            {tutorial.shouldShow && hintTarget ? (
              <DragHint
                toX={hintTarget.centerX}
                toY={hintTarget.centerY}
                message="Drag each card onto an open slot. 1 is best. A filled slot will not take another."
              />
            ) : null}
          </View>

          <View style={styles.column}>
            {/* Worst-to-best, top-to-bottom (15.3): rendered in reverse of `targets`'
                index order, matching the negated centerY above so the slot under the
                finger is always the one the render puts in that spot on screen. */}
            <View style={styles.endLabelSlot}>
              <Text style={styles.endLabel} numberOfLines={1}>
                {worstLabel}
              </Text>
            </View>

            {[...targets].reverse().map((target) => (
              <RankSlot
                key={target.value}
                target={target}
                targets={targets}
                pointerX={pointerX}
                pointerY={pointerY}
                option={optionsById.get(placements[target.value] ?? "")}
                mediaType={question.mediaType}
                slotHeight={SLOT_HEIGHT + SLOT_GAP}
                disabled={!isActive}
                onReclaim={reclaim}
                onPlace={place}
                onSwap={swap}
                swapTargetValue={swapTargetValue}
                swapNearness={swapNearness}
              />
            ))}

            <View style={styles.endLabelSlot}>
              <Text style={styles.endLabel} numberOfLines={1}>
                {bestLabel}
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
  slotHeight,
  disabled,
  onReclaim,
  onPlace,
  onSwap,
  swapTargetValue,
  swapNearness,
}: {
  target: DropTarget;
  targets: DropTarget[];
  pointerX: SharedValue<number>;
  pointerY: SharedValue<number>;
  option: EvaluatorOption | undefined;
  mediaType: string | null;
  /** Centre-to-centre distance between adjacent slots, for turning a swap drag's
   * translationY into a number of slots crossed. */
  slotHeight: number;
  disabled: boolean;
  onReclaim: (slotNumber: number) => void;
  onPlace: (slotNumber: number) => void;
  onSwap: (sourceValue: number, targetValue: number) => void;
  /** Which slot value a swap-in-progress is currently crossing (16.1), and how close it
   * sits to this slot's centre - shared across every slot so the one being crossed can
   * grow the same way the placement drag's `isUnderFinger` branch below already does. */
  swapTargetValue: SharedValue<number>;
  swapNearness: SharedValue<number>;
}) {
  const filled = !target.enabled;

  const animated = useAnimatedStyle(() => {
    // Only the slot under the finger reacts. Lighting up every nearby slot would suggest
    // the card could land in any of them, when exactly one will take it.
    const isUnderFinger =
      activeTargetValue(pointerX.value, pointerY.value, targets) === target.value;
    if (isUnderFinger) {
      const nearness = targetProximity(pointerX.value, pointerY.value, target, PROXIMITY_FALLOFF);
      return {
        transform: [{ scale: 1 + nearness * (MAX_SLOT_SCALE - 1) }],
        borderColor: theme.colors.accent,
      };
    }
    // A held thumbnail from another slot is being dragged across this one (16.1) - same
    // "grow near a target" shape, driven by the swap gesture's shared nearness instead of
    // the placement drag's pointer position.
    if (swapTargetValue.value === target.value) {
      return {
        transform: [{ scale: 1 + swapNearness.value * (MAX_SLOT_SCALE - 1) }],
        borderColor: theme.colors.accent,
      };
    }
    return { transform: [{ scale: 1 }], borderColor: theme.colors.borderHairline };
  });

  return (
    <View style={styles.slotWrap}>
      {/* The notch is what makes a rank slot read as a tag rather than Rating's pill: a
          diamond the same colour as the card behind it, half overlapping the slot's outer
          (right) edge so it reads as a cut corner rather than a separate shape drawn on
          top. Deliberately not the left edge: that's where the dragged card arrives from
          (see `centerX`'s derivation above), and a notch there would sit on the incoming
          thumbnail's leading edge mid-drag instead of reading as the slot's own shape. It
          sits outside the slot's own `overflow: "hidden"` so the cut isn't clipped away. */}
      <View style={styles.notch} pointerEvents="none" />
      <Animated.View style={[styles.slot, filled && styles.slotFilled, animated]}>
        {filled && option ? (
          <SwappableThumbnail
            slotValue={target.value}
            slotCount={targets.length}
            slotHeight={slotHeight}
            option={option}
            mediaType={mediaType}
            disabled={disabled}
            onReclaim={onReclaim}
            onSwap={onSwap}
            swapTargetValue={swapTargetValue}
            swapNearness={swapNearness}
          />
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

/**
 * Where a swap drag's `translateY` currently sits relative to the slot it would land on
 * (16.1): which slot value that is (0 if still over the source slot, or past either end
 * with nowhere valid to land), and how close - 0 (mid-transition) to 1 (dead on that
 * slot's centre). Same "grow near a target" shape as `targetProximity`, just measured
 * along this gesture's 1D `translateY` instead of 2D pointer coordinates, since a swap
 * drag never tracks the raw finger position (see `SwappableThumbnail`'s doc below).
 */
function computeSwapCrossing(
  translateY: number,
  slotHeight: number,
  slotValue: number,
  slotCount: number
): { targetValue: number; nearness: number } {
  "worklet";
  // Downward drag moves toward the bottom of the column, where rank 1 sits after 15.3's
  // flip - value decreases as the finger moves down, hence the negation.
  const delta = Math.round(-translateY / slotHeight);
  if (delta === 0) return { targetValue: 0, nearness: 0 };
  const targetValue = Math.max(1, Math.min(slotCount, slotValue + delta));
  if (targetValue === slotValue) return { targetValue: 0, nearness: 0 };
  const targetTranslateY = -delta * slotHeight;
  const distance = Math.abs(translateY - targetTranslateY);
  const nearness = distance >= PROXIMITY_FALLOFF ? 0 : 1 - distance / PROXIMITY_FALLOFF;
  return { targetValue, nearness };
}

/**
 * A filled slot's own thumbnail: a tap reclaims it (existing 12.1/12.6 flow, unchanged),
 * and a press-and-hold followed by a drag swaps it directly with whatever slot the finger
 * ends up over (15.6) - a shortcut alongside reclaim-then-place, not instead of it.
 *
 * `Gesture.Race` picks whichever of the two actually activates: a quick tap wins before
 * the hold threshold ever fires; holding still past it activates the pan instead, and the
 * tap is cancelled by Race the moment that happens. Reading the swap target off
 * `translationY` alone - rather than re-deriving pointer coordinates in this thumbnail's
 * own space - works because every slot sits exactly `slotHeight` from its neighbour, so
 * "how many slots did the finger cross" is just that division, independent of which slot
 * this drag started on.
 */
function SwappableThumbnail({
  slotValue,
  slotCount,
  slotHeight,
  option,
  mediaType,
  disabled,
  onReclaim,
  onSwap,
  swapTargetValue,
  swapNearness,
}: {
  slotValue: number;
  slotCount: number;
  slotHeight: number;
  option: EvaluatorOption;
  mediaType: string | null;
  disabled: boolean;
  onReclaim: (slotNumber: number) => void;
  onSwap: (sourceValue: number, targetValue: number) => void;
  swapTargetValue: SharedValue<number>;
  swapNearness: SharedValue<number>;
}) {
  const translateY = useSharedValue(0);

  // Place entrance (16.9): this component only ever mounts fresh the moment a slot goes
  // from empty to filled - a swap (15.6) reuses the same instance, just changing `option`
  // - so a plain mount effect is exactly "a card was just placed here", no extra state to
  // track. Shrinks down from larger/more-transparent to resting size/opacity.
  const reducedMotion = useReducedMotion();
  const placeEntranceScale = useSharedValue(reducedMotion ? 1 : PLACE_ENTRANCE_START_SCALE);
  const placeEntranceOpacity = useSharedValue(reducedMotion ? 1 : ENTRANCE_START_OPACITY);

  useEffect(() => {
    if (reducedMotion) {
      placeEntranceOpacity.value = withTiming(1, { duration: REDUCED_MOTION_FADE_MS });
      return;
    }
    placeEntranceScale.value = withSpring(1, CARD_ENTRANCE_SPRING);
    placeEntranceOpacity.value = withSpring(1, CARD_ENTRANCE_SPRING);
  }, [reducedMotion, placeEntranceScale, placeEntranceOpacity]);

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDistance(10)
    .onEnd((_event, success) => {
      if (success) runOnJS(onReclaim)(slotValue);
    });

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activateAfterLongPress(SWAP_LONG_PRESS_MS)
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const { targetValue } = computeSwapCrossing(event.translationY, slotHeight, slotValue, slotCount);
      // Springing back to 0 here also carries the shared crossing state below back to
      // resting (its reaction keeps firing for every frame of this animation), so both
      // this thumbnail and whichever slot it was over settle together off one spring.
      translateY.value = withSpring(0, CARD_REJECT_SPRING);
      if (targetValue !== 0) runOnJS(onSwap)(slotValue, targetValue);
    });

  // Broadcasts the currently-crossed slot (if any) so that slot's own RankSlot can grow
  // in step with this thumbnail - fires on every frame translateY changes, including
  // during the release spring above, which is what lets the highlight fade back out
  // smoothly instead of snapping off the instant the gesture ends.
  useAnimatedReaction(
    () => translateY.value,
    (ty) => {
      const { targetValue, nearness } = computeSwapCrossing(ty, slotHeight, slotValue, slotCount);
      swapTargetValue.value = targetValue;
      swapNearness.value = nearness;
    },
    [slotHeight, slotValue, slotCount]
  );

  const followFinger = useAnimatedStyle(() => {
    const { nearness } = computeSwapCrossing(translateY.value, slotHeight, slotValue, slotCount);
    return {
      opacity: placeEntranceOpacity.value,
      transform: [
        { translateY: translateY.value },
        { scale: placeEntranceScale.value * (1 + nearness * (MAX_SLOT_SCALE - 1)) },
      ],
      zIndex: translateY.value === 0 ? 0 : 1,
    };
  });

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <Animated.View
        style={[styles.slotThumbnailPressable, followFinger]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Rank ${slotValue}: ${option.label ?? "this card"}. Tap to remove it, or hold and drag to swap with another rank.`}
        accessibilityState={{ disabled }}
      >
        <SlotThumbnail option={option} mediaType={mediaType} />
      </Animated.View>
    </GestureDetector>
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
    paddingHorizontal: ROW_PADDING,
    paddingBottom: theme.spacing(2),
  },
  currentCardEntrance: { flex: 1 },
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
  // Sits outside `slot`'s clip, centred on its outer (right) edge, coloured to match the
  // card surface behind it - so it reads as a bite taken out of the slot's corner.
  notch: {
    position: "absolute",
    right: -NOTCH_SIZE / 2,
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
