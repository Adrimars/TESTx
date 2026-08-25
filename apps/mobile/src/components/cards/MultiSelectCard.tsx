import { useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { CardMedia } from "./CardMedia";
import { CardStack } from "./CardStack";
import { SwipeCard } from "./SwipeCard";
import type { ReleaseGesture } from "./SwipeCard";
import { advanceSubDeck, resolveHorizontalRelease } from "@/lib/swipe";
import type { EvaluatorOption, EvaluatorQuestion } from "@/lib/test";
import { theme } from "@/lib/theme";

const DISTANCE_THRESHOLD_RATIO = 0.28;
const VELOCITY_THRESHOLD = 700;
const MIN_FLICK_TRAVEL = 24;

type MultiSelectCardProps = {
  question: EvaluatorQuestion;
  isActive: boolean;
  onAnswer: (optionIds: string[]) => void;
};

/**
 * Multi select as a sub-deck: one card per option, swipe right to include and left to
 * skip. Asking about one option at a time is what makes it a swipe question at all - a
 * checklist would just be the tap card again.
 *
 * The sub-deck holds the outer feed until the configured minimum and maximum are both
 * satisfied. Running out of cards with too few chosen re-offers the skipped ones rather
 * than advancing with an answer the API would reject.
 */
export function MultiSelectCard({ question, isActive, onAnswer }: MultiSelectCardProps) {
  const { width } = useWindowDimensions();
  const min = question.config.minSelections ?? 0;
  const max = question.config.maxSelections ?? question.options.length;

  const byId = useMemo(
    () => new Map(question.options.map((option) => [option.id, option])),
    [question.options]
  );

  const [state, setState] = useState({
    queue: question.options.map((option) => option.id),
    cursor: 0,
    included: [] as string[],
  });
  const [reconsidering, setReconsidering] = useState(false);

  const included = state.included;
  const atMax = included.length >= max;
  const queue = state.queue;
  const cursor = state.cursor;

  function decide(optionId: string, include: boolean) {
    const step = advanceSubDeck(state, optionId, include, min);
    if (step.type === "complete") {
      onAnswer(step.included);
      return;
    }
    if (step.type === "reconsider") setReconsidering(true);
    setState(step.state);
  }

  // A MULTI_SELECT with no options is rejected at authoring time, but the sub-deck is
  // what holds the outer feed - if one ever arrived it would wedge the whole deck rather
  // than misrender a single card.
  if (queue.length === 0) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.header}>
          <Text style={styles.prompt}>{question.prompt}</Text>
          <Text style={styles.notice}>This question has no options.</Text>
        </View>
      </View>
    );
  }

  const remaining = queue.length - cursor;

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.prompt}>{question.prompt}</Text>
        <Text style={styles.status}>
          {included.length} chosen · {remaining} left
          {atMax ? ` · max ${max} reached, swipe left` : min > 0 ? ` · pick at least ${min}` : ""}
        </Text>
        {reconsidering ? (
          <Text style={styles.notice}>
            Pick at least {min}. Here are the ones you skipped.
          </Text>
        ) : null}
      </View>

      <CardStack
        items={queue}
        activeIndex={cursor}
        keyExtractor={(optionId) => optionId}
        renderCard={(optionId, cardIsActive) => {
          const option = byId.get(optionId);
          if (!option) return null;
          return (
            <OptionSwipeCard
              option={option}
              mediaType={question.mediaType}
              isActive={isActive && cardIsActive}
              width={width}
              atMax={atMax}
              onDecide={(include) => decide(optionId, include)}
            />
          );
        }}
      />
    </View>
  );
}

function OptionSwipeCard({
  option,
  mediaType,
  isActive,
  width,
  atMax,
  onDecide,
}: {
  option: EvaluatorOption;
  mediaType: string | null;
  isActive: boolean;
  width: number;
  atMax: boolean;
  onDecide: (include: boolean) => void;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const distanceThreshold = width * DISTANCE_THRESHOLD_RATIO;

  const onRelease = (gesture: ReleaseGesture) => {
    "worklet";
    const decision = resolveHorizontalRelease(gesture, {
      distance: distanceThreshold,
      velocity: VELOCITY_THRESHOLD,
      minFlickTravel: MIN_FLICK_TRAVEL,
    });
    if (!decision.commit) return { commit: false as const };

    // At the cap, including is not a legal move, so the card springs back instead of
    // committing. Skipping stays available - that is how the sub-deck finishes.
    if (decision.direction > 0 && atMax) return { commit: false as const };

    return {
      commit: true as const,
      value: decision.direction > 0 ? 1 : 0,
      flyTo: { x: decision.direction * (width + 200), y: gesture.y },
    };
  };

  const includeHint = useAnimatedStyle(() => ({
    opacity: atMax ? 0 : Math.min(Math.max(x.value / distanceThreshold, 0), 1),
  }));
  const skipHint = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(-x.value / distanceThreshold, 0), 1),
  }));

  return (
    <SwipeCard
      width={width}
      enabled={isActive}
      position={isActive ? { x, y } : undefined}
      onRelease={onRelease}
      onCommit={(value) => onDecide(value === 1)}
    >
      <View style={styles.optionBody}>
        <CardMedia
          mediaType={mediaType}
          url={option.mediaUrl}
          label={option.label}
          isActive={isActive}
        />

        <Animated.View style={[styles.stamp, styles.stampSkip, skipHint]} pointerEvents="none">
          <Text style={styles.stampText}>SKIP</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampInclude, includeHint]} pointerEvents="none">
          <Text style={styles.stampText}>PICK</Text>
        </Animated.View>

        <View style={styles.captionBar} pointerEvents="none">
          <Text style={styles.captionSide}>{"← Skip"}</Text>
          <Text style={styles.captionLabel} numberOfLines={1}>
            {option.label ?? ""}
          </Text>
          <Text style={styles.captionSide}>{atMax ? "Max reached" : "Pick →"}</Text>
        </View>
      </View>
    </SwipeCard>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  header: { gap: theme.spacing(0.5), paddingHorizontal: theme.spacing(2) },
  prompt: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "600", lineHeight: 24 },
  status: { color: theme.colors.textSecondary, fontSize: 13 },
  notice: { color: theme.colors.accent, fontSize: 13, fontWeight: "600" },
  optionBody: { flex: 1 },
  stamp: {
    position: "absolute",
    top: theme.spacing(2),
    paddingHorizontal: theme.spacing(1.5),
    paddingVertical: theme.spacing(0.75),
    borderRadius: 8,
    borderWidth: 3,
  },
  stampSkip: { left: theme.spacing(2), borderColor: theme.colors.danger },
  stampInclude: { right: theme.spacing(2), borderColor: theme.colors.accent },
  stampText: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  captionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    backgroundColor: "rgba(11, 11, 15, 0.72)",
  },
  captionSide: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" },
  captionLabel: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600", flexShrink: 1 },
});
