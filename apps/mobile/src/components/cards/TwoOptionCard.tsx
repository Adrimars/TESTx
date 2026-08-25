import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { X } from "lucide-react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { CardMedia } from "./CardMedia";
import { SwipeCard } from "./SwipeCard";
import type { ReleaseGesture } from "./SwipeCard";
import { resolveMediaUrl } from "@/lib/env";
import { resolveHorizontalRelease } from "@/lib/swipe";
import type { EvaluatorOption, EvaluatorQuestion } from "@/lib/test";
import { theme } from "@/lib/theme";

/** Fraction of the screen width a card must travel before a release counts as a choice. */
const DISTANCE_THRESHOLD_RATIO = 0.28;
/** A fast flick commits earlier, but still has to be a deliberate movement. */
const VELOCITY_THRESHOLD = 700;
const MIN_FLICK_TRAVEL = 24;

type TwoOptionCardProps = {
  question: EvaluatorQuestion;
  isActive: boolean;
  /** Receives the id of the option the evaluator swiped to. */
  onAnswer: (optionId: string) => void;
};

/**
 * The two-option single select: the whole card is the control. Swiping right picks the
 * first option, swiping left picks the second, which is why both are drawn on the side
 * that selects them - the layout is the only instruction the gesture gets.
 */
export function TwoOptionCard({ question, isActive, onAnswer }: TwoOptionCardProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const [rightOption, leftOption] = [question.options[0], question.options[1]];
  const distanceThreshold = width * DISTANCE_THRESHOLD_RATIO;

  // Each half only ever shows a cropped slice of its photo (see the split layout below).
  // Tapping a side opens that option's photo uncropped so the evaluator can actually judge
  // it before committing to a swipe. Scoped to IMAGE questions - a cropped video/text/audio
  // half isn't the bug being fixed here.
  const [previewOption, setPreviewOption] = useState<EvaluatorOption | null>(null);
  const canPreview = question.mediaType === "IMAGE";

  const onRelease = (gesture: ReleaseGesture) => {
    "worklet";
    const decision = resolveHorizontalRelease(gesture, {
      distance: distanceThreshold,
      velocity: VELOCITY_THRESHOLD,
      minFlickTravel: MIN_FLICK_TRAVEL,
    });

    if (!decision.commit) return { commit: false as const };

    return {
      commit: true as const,
      value: decision.direction > 0 ? 0 : 1,
      flyTo: { x: decision.direction * (width + 200), y: gesture.y },
    };
  };

  const rightHighlight = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(x.value / distanceThreshold, 0), 1),
  }));
  const leftHighlight = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(-x.value / distanceThreshold, 0), 1),
  }));

  function handleCommit(value: number) {
    const chosen = value === 0 ? rightOption : leftOption;
    if (chosen) onAnswer(chosen.id);
  }

  /**
   * Tap-based fallback for the swipe gesture (prd.md §16.7). For an IMAGE question, a tap
   * opens the full-photo preview (12.1) rather than committing immediately - the whole
   * point of that preview is seeing the photo uncropped *before* choosing it, so the
   * preview's own "Choose this" button is what actually commits. Any other media type has
   * no cropping problem to solve first, so a tap there commits directly.
   */
  function handleHalfPress(option: EvaluatorOption | undefined) {
    if (!option) return;
    if (canPreview) {
      setPreviewOption(option);
    } else {
      onAnswer(option.id);
    }
  }

  return (
    <SwipeCard
      width={width}
      enabled={isActive}
      position={isActive ? { x, y } : undefined}
      onRelease={onRelease}
      onCommit={handleCommit}
    >
      <View style={styles.body}>
        <Text style={styles.prompt}>{question.prompt}</Text>

        <View style={styles.halves}>
          <Pressable
            style={styles.half}
            disabled={!isActive || !leftOption}
            onPress={() => handleHalfPress(leftOption)}
            accessibilityRole="button"
            accessibilityLabel={leftOption?.label ?? "Choose this side"}
          >
            <CardMedia
              mediaType={question.mediaType}
              url={leftOption?.mediaUrl ?? null}
              label={leftOption?.label ?? null}
              isActive={isActive}
            />
            <Animated.View style={[styles.highlight, styles.highlightLeft, leftHighlight]} />
            <View style={[styles.caption, NO_TOUCH]}>
              <Text style={styles.captionArrow}>{"←"}</Text>
              <Text style={styles.captionLabel} numberOfLines={2}>
                {leftOption?.label ?? "Swipe left"}
              </Text>
            </View>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={styles.half}
            disabled={!isActive || !rightOption}
            onPress={() => handleHalfPress(rightOption)}
            accessibilityRole="button"
            accessibilityLabel={rightOption?.label ?? "Choose this side"}
          >
            <CardMedia
              mediaType={question.mediaType}
              url={rightOption?.mediaUrl ?? null}
              label={rightOption?.label ?? null}
              isActive={isActive}
            />
            <Animated.View style={[styles.highlight, styles.highlightRight, rightHighlight]} />
            <View style={[styles.caption, NO_TOUCH]}>
              <Text style={styles.captionLabel} numberOfLines={2}>
                {rightOption?.label ?? "Swipe right"}
              </Text>
              <Text style={styles.captionArrow}>{"→"}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={previewOption !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewOption(null)}
      >
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewOption(null)}>
          <Image
            source={{ uri: resolveMediaUrl(previewOption?.mediaUrl ?? null) ?? undefined }}
            style={styles.previewImage}
            resizeMode="contain"
          />
          <Pressable
            style={[styles.previewClose, { top: insets.top + theme.spacing(1.5) }]}
            onPress={() => setPreviewOption(null)}
            accessibilityRole="button"
            accessibilityLabel="Close photo preview"
          >
            <X size={22} color={theme.colors.textPrimary} strokeWidth={1.5} />
          </Pressable>

          {/* The preview only shows the photo - this is what actually commits the
              evaluator's choice, once they've seen it uncropped. */}
          <View style={[styles.previewActions, { paddingBottom: insets.bottom + theme.spacing(2) }]}>
            <Button
              label={`Choose ${previewOption?.label ?? "this photo"}`}
              onPress={() => {
                if (previewOption) onAnswer(previewOption.id);
                setPreviewOption(null);
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </SwipeCard>
  );
}

/** Inert overlay: the deprecated pointerEvents prop moved onto style. */
const NO_TOUCH = { pointerEvents: "none" } as const;

const styles = StyleSheet.create({
  body: { flex: 1 },
  prompt: {
    color: theme.colors.textPrimary,
    ...theme.type.prompt,
    padding: theme.spacing(2),
  },
  halves: { flex: 1, flexDirection: "row" },
  half: { flex: 1, overflow: "hidden" },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.borderHairline },
  highlight: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 3,
  },
  highlightLeft: {
    backgroundColor: theme.withAlpha(theme.colors.accent, 0.28),
    borderColor: theme.colors.accent,
  },
  highlightRight: {
    backgroundColor: theme.withAlpha(theme.colors.accent, 0.28),
    borderColor: theme.colors.accent,
  },
  caption: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    backgroundColor: theme.withAlpha(theme.colors.surfaceBase, 0.72),
  },
  captionArrow: { color: theme.colors.textSecondary, fontSize: 18, fontWeight: "700" },
  captionLabel: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "600", flexShrink: 1 },
  previewBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.surfaceBase,
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: { width: "100%", height: "100%" },
  previewClose: {
    position: "absolute",
    right: theme.spacing(2),
    // 44pt minimum touch target (prd.md §16.7).
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceOverlay,
  },
  previewActions: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.spacing(3),
  },
});
