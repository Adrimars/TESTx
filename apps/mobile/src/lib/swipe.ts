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

/** Sub-deck cursor state for a multi select, in option ids. */
export type SubDeckState = {
  /** Option ids still being offered, in the order they are shown. */
  queue: string[];
  cursor: number;
  included: string[];
};

export type SubDeckStep =
  | { type: "next"; state: SubDeckState }
  /** Every option has been decided and the minimum is met. */
  | { type: "complete"; included: string[] }
  /** Cards ran out with too few chosen; the skipped ones come back around. */
  | { type: "reconsider"; state: SubDeckState };

/**
 * Applies one include/skip decision to a multi select sub-deck.
 *
 * Reaching the end with fewer than `min` chosen does not complete the question - the API
 * would reject it and the evaluator would lose the work - so the skipped options are
 * re-offered instead. Only the skipped ones come back, because the included ones are not
 * decisions that still need making.
 *
 * The maximum is not enforced here: refusing to include is a gesture-level decision the
 * card makes before a commit ever happens, so a step that arrives here is already legal.
 */
export function advanceSubDeck(
  state: SubDeckState,
  optionId: string,
  include: boolean,
  min: number
): SubDeckStep {
  const included = include ? [...state.included, optionId] : state.included;
  const cursor = state.cursor + 1;

  if (cursor < state.queue.length) {
    return { type: "next", state: { ...state, cursor, included } };
  }

  if (included.length >= min) {
    return { type: "complete", included };
  }

  const skipped = state.queue.filter((id) => !included.includes(id));
  return { type: "reconsider", state: { queue: skipped, cursor: 0, included } };
}
