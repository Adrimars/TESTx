import { useRef } from "react";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { CARD_COMMIT_MS, CARD_REJECT_SPRING, REDUCED_MOTION_FADE_MS } from "@/lib/motion";
import { theme } from "@/lib/theme";

/** Card offset from its resting position, in pixels. */
export type DragPosition = { x: SharedValue<number>; y: SharedValue<number> };

export type ReleaseGesture = {
  x: number;
  y: number;
  pointerX: number;
  pointerY: number;
  velocityX: number;
  velocityY: number;
};

export type ReleaseDecision =
  | { commit: false }
  | { commit: true; value: number; flyTo?: { x: number; y: number } };

const DEFAULT_FLY_DISTANCE = 700;

/** A move sample older than this cannot speak for the current release - a finger that
 * paused mid-drag before lifting should not report the flick it made a while ago. */
const VELOCITY_SAMPLE_MAX_AGE_MS = 100;

type SwipeCardProps = {
  children: ReactNode;
  onRelease: (gesture: ReleaseGesture) => ReleaseDecision;
  onCommit?: (value: number) => void;
  onDragStart?: () => void;
  position?: DragPosition;
  pointer?: DragPosition;
  enabled?: boolean;
  maxTiltDeg?: number;
  width: number;
  style?: StyleProp<ViewStyle>;
  surface?: boolean;
};

/**
 * Web override (18.3).
 *
 * react-native-gesture-handler's web Pan recognizer did not reliably turn pointer input
 * into position deltas in this app's own testing - a real mouse drag, and a hand-built
 * PointerEvent sequence with proper intermediate moves, both left the card inert, while
 * its Tap-based siblings (TapZone) worked unmodified with no changes at all. That points
 * at RNGH's web Pan handler specifically, not at reanimated (which renders the resulting
 * styles fine) or at gesture recognition on web in general.
 *
 * So this reimplements only the missing piece - raw `pointerdown`/`pointermove`/
 * `pointerup` turned into the same `translateX`/`translateY`/`pointerX`/`pointerY`
 * SharedValues RatingCard/RankingCard already read - rather than replacing the
 * animation layer under it. Everything below `onRelease` (the spring-back, the
 * commit fly-off, the reduced-motion fade) is copied from the native file unchanged.
 */
export function SwipeCard({
  children,
  onRelease,
  onCommit,
  onDragStart,
  position,
  pointer,
  enabled = true,
  maxTiltDeg = 8,
  width,
  style,
  surface = true,
}: SwipeCardProps) {
  const ownX = useSharedValue(0);
  const ownY = useSharedValue(0);
  const ownPointerX = useSharedValue(0);
  const ownPointerY = useSharedValue(0);
  const translateX = position?.x ?? ownX;
  const translateY = position?.y ?? ownY;
  const pointerX = pointer?.x ?? ownPointerX;
  const pointerY = pointer?.y ?? ownPointerY;

  /** Where on the card the finger grabbed it, relative to the card's centre - fixed for
   * the life of the gesture, same role as the native file's grabX/grabY. */
  const grabX = useSharedValue(0);
  const grabY = useSharedValue(0);

  const boxWidth = useSharedValue(0);
  const boxHeight = useSharedValue(0);

  const isSettling = useSharedValue(false);
  const settleProgress = useSharedValue(0);

  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  const nodeRef = useRef<View>(null);
  const activePointerId = useRef<number | null>(null);
  /** clientX/Y at the moment the drag started - translationX/Y is just the delta from
   * here, mirroring RNGH's own `event.translationX` rather than re-deriving it from a
   * bounding rect that itself moves as the card translates. */
  const startClientX = useRef(0);
  const startClientY = useRef(0);
  /** Most recent prior move, for a velocity estimate on release - RNGH hands this over
   * directly on native; a raw PointerEvent does not. */
  const lastSample = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastVelocityX = useRef(0);
  const lastVelocityY = useRef(0);

  function resetDragTracking() {
    activePointerId.current = null;
    lastSample.current = null;
    lastVelocityX.current = 0;
    lastVelocityY.current = 0;
  }

  function handlePointerDown(event: {
    nativeEvent: { pointerId: number; clientX: number; clientY: number; button: number };
  }) {
    if (!enabled || isSettling.value) return;
    // Primary button only, matching RNGH's own `isButtonInConfig` check - a right- or
    // middle-click must not drag a card. Touch and pen contacts both report 0 here.
    if (event.nativeEvent.button !== 0) return;
    const node = nodeRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const { pointerId, clientX, clientY } = event.nativeEvent;
    // A pointer capture request can be rejected (e.g. the pointer already lifted between
    // the event firing and this running) - that must not abort tracking the drag itself.
    try {
      node.setPointerCapture?.(pointerId);
    } catch {
      // Ignored - see above.
    }
    activePointerId.current = pointerId;
    startClientX.current = clientX;
    startClientY.current = clientY;
    lastSample.current = { x: clientX, y: clientY, t: Date.now() };
    lastVelocityX.current = 0;
    lastVelocityY.current = 0;

    // The rect moves with the card, so a grab landing while a previous rejected drag is
    // still springing back would be measured against where the card currently sits.
    // `pointerX`/`pointerY` are defined relative to the card's *resting* centre - that is
    // the space the drag-to-target hit-testing works in - so undo the live translate here.
    const rect = node.getBoundingClientRect();
    const localX = clientX - rect.left + translateX.value;
    const localY = clientY - rect.top + translateY.value;
    grabX.value = boxWidth.value > 0 ? localX - boxWidth.value / 2 : 0;
    grabY.value = boxHeight.value > 0 ? localY - boxHeight.value / 2 : 0;
    pointerX.value = grabX.value;
    pointerY.value = grabY.value;

    if (onDragStart) onDragStart();
  }

  function handlePointerMove(event: { nativeEvent: { pointerId: number; clientX: number; clientY: number } }) {
    const { pointerId, clientX, clientY } = event.nativeEvent;
    if (activePointerId.current === null || pointerId !== activePointerId.current) return;
    if (isSettling.value) return;

    const now = Date.now();
    const previous = lastSample.current;
    if (previous) {
      const dt = now - previous.t;
      // A near-zero dt (two moves in the same frame) would blow the division up; that
      // frame's velocity just carries over from the last valid sample instead.
      if (dt > 4) {
        lastVelocityX.current = ((clientX - previous.x) / dt) * 1000;
        lastVelocityY.current = ((clientY - previous.y) / dt) * 1000;
      }
    }
    lastSample.current = { x: clientX, y: clientY, t: now };

    const dx = clientX - startClientX.current;
    const dy = clientY - startClientY.current;
    translateX.value = dx;
    translateY.value = dy;
    pointerX.value = grabX.value + dx;
    pointerY.value = grabY.value + dy;
  }

  function handlePointerUp(event: { nativeEvent: { pointerId: number } }) {
    const { pointerId } = event.nativeEvent;
    if (activePointerId.current === null || pointerId !== activePointerId.current) return;
    const node = nodeRef.current as unknown as HTMLElement | null;
    try {
      node?.releasePointerCapture?.(pointerId);
    } catch {
      // Ignored - the pointer may already be gone by the time this runs.
    }
    if (isSettling.value) {
      resetDragTracking();
      return;
    }

    // A velocity sample that predates the release by too long belongs to a finger that
    // had already stopped, not to a flick.
    const velocityX = Date.now() - (lastSample.current?.t ?? 0) <= VELOCITY_SAMPLE_MAX_AGE_MS
      ? lastVelocityX.current
      : 0;
    const velocityY = Date.now() - (lastSample.current?.t ?? 0) <= VELOCITY_SAMPLE_MAX_AGE_MS
      ? lastVelocityY.current
      : 0;

    const decision = onRelease({
      x: translateX.value,
      y: translateY.value,
      pointerX: pointerX.value,
      pointerY: pointerY.value,
      velocityX,
      velocityY,
    });

    resetDragTracking();

    if (!decision.commit) {
      if (reducedMotion) {
        translateX.value = 0;
        translateY.value = 0;
        pointerX.value = 0;
        pointerY.value = 0;
      } else {
        translateX.value = withSpring(0, CARD_REJECT_SPRING);
        translateY.value = withSpring(0, CARD_REJECT_SPRING);
        pointerX.value = withSpring(0, CARD_REJECT_SPRING);
        pointerY.value = withSpring(0, CARD_REJECT_SPRING);
      }
      return;
    }

    isSettling.value = true;
    const committed = decision.value;

    if (reducedMotion) {
      opacity.value = withTiming(0, { duration: REDUCED_MOTION_FADE_MS }, (finished) => {
        if (finished && onCommit) {
          onCommit(committed);
        }
      });
      return;
    }

    const target = decision.flyTo ?? {
      x: Math.sign(translateX.value || velocityX || 1) * DEFAULT_FLY_DISTANCE,
      y: translateY.value,
    };

    translateX.value = withTiming(target.x, { duration: CARD_COMMIT_MS });
    translateY.value = withTiming(target.y, { duration: CARD_COMMIT_MS });

    settleProgress.value = 0;
    settleProgress.value = withTiming(1, { duration: CARD_COMMIT_MS }, (finished) => {
      if (finished && onCommit) {
        onCommit(committed);
      }
    });
  }

  function handlePointerCancel(event: { nativeEvent: { pointerId: number } }) {
    const { pointerId } = event.nativeEvent;
    if (activePointerId.current === null || pointerId !== activePointerId.current) return;
    resetDragTracking();
    if (isSettling.value) return;
    // No deliberate release happened - spring back rather than evaluate onRelease.
    if (reducedMotion) {
      translateX.value = 0;
      translateY.value = 0;
      pointerX.value = 0;
      pointerY.value = 0;
    } else {
      translateX.value = withSpring(0, CARD_REJECT_SPRING);
      translateY.value = withSpring(0, CARD_REJECT_SPRING);
      pointerX.value = withSpring(0, CARD_REJECT_SPRING);
      pointerY.value = withSpring(0, CARD_REJECT_SPRING);
    }
  }

  const animatedStyle = useAnimatedStyle(() => {
    const tilt =
      maxTiltDeg === 0 || reducedMotion
        ? 0
        : interpolate(translateX.value, [-width, 0, width], [-maxTiltDeg, 0, maxTiltDeg]);

    return {
      opacity: opacity.value,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotateZ: `${tilt}deg` },
      ],
    };
  });

  function onLayout(event: LayoutChangeEvent) {
    boxWidth.value = event.nativeEvent.layout.width;
    boxHeight.value = event.nativeEvent.layout.height;
  }

  return (
    <Animated.View
      ref={nodeRef}
      onLayout={onLayout}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      // Without this, a touch-device drag also scrolls/pans the page underneath it -
      // RNGH's native web Pan handler set this itself; this override has to do it by hand.
      style={[surface ? styles.shadow : styles.flexFill, style, styles.touchNone, animatedStyle]}
    >
      <View style={surface ? styles.surface : styles.flexFill}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  shadow: { flex: 1, ...theme.card.shadow },
  surface: theme.card.surface,
  touchNone: { touchAction: "none" },
});
