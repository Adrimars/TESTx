/**
 * Pure release maths for the swipe engine, kept free of react-native imports so it can
 * be exercised without a native runtime - same reasoning as version.ts.
 *
 * These carry the 'worklet' directive because the gesture callbacks call them on the UI
 * thread, but that does not stop them being plain functions to a test.
 */

export type HorizontalRelease = {
  /** Distance travelled from the card's resting position. */
  x: number;
  velocityX: number;
};

export type HorizontalThresholds = {
  distance: number;
  velocity: number;
  /** A flick still has to move the card this far, so jitter under a tap cannot commit. */
  minFlickTravel: number;
};

export type HorizontalDecision =
  | { commit: false }
  | { commit: true; direction: 1 | -1 };

/**
 * Decides whether letting go of a horizontally dragged card counts as a choice, and
 * which way. A slow drag past `distance` commits; so does a fast flick that cleared
 * `minFlickTravel`, because the finger often lifts early on a deliberate throw.
 */
export function resolveHorizontalRelease(
  release: HorizontalRelease,
  thresholds: HorizontalThresholds
): HorizontalDecision {
  "worklet";
  const travelled = Math.abs(release.x);
  const clearedDistance = travelled > thresholds.distance;
  const flicked =
    Math.abs(release.velocityX) > thresholds.velocity && travelled > thresholds.minFlickTravel;

  if (!clearedDistance && !flicked) return { commit: false };

  // On a flick the velocity is the more honest signal of which way the card was thrown;
  // on a slow drag the card's own position is.
  const signal = clearedDistance ? release.x : release.velocityX;
  return { commit: true, direction: signal < 0 ? -1 : 1 };
}
