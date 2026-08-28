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
  /** Every option has been decided, whether zero, some, or all were included. */
  | { type: "complete"; included: string[] };

/**
 * Applies one include/skip decision to a multi select sub-deck.
 *
 * Each option is an independent like/dislike call - liking zero, some, or all of them is
 * a complete answer, so reaching the end of the queue always completes the question.
 * Nothing here re-offers a skipped option to force a minimum; the API never enforced one
 * server-side (only `maxSelections`), so this was a mobile-only retry-loop, not a
 * contract the answer shape depends on.
 *
 * The maximum is not enforced here: refusing to include is a gesture-level decision the
 * card makes before a commit ever happens, so a step that arrives here is already legal.
 */
export function advanceSubDeck(
  state: SubDeckState,
  optionId: string,
  include: boolean
): SubDeckStep {
  const included = include ? [...state.included, optionId] : state.included;
  const cursor = state.cursor + 1;

  if (cursor < state.queue.length) {
    return { type: "next", state: { ...state, cursor, included } };
  }

  return { type: "complete", included };
}

/** A drop target's centre and its half-height, in the card's coordinate space. */
export type DropTarget = {
  /** What committing on this target means: a rating value, or a ranking slot number. */
  value: number;
  centerX: number;
  centerY: number;
  /** Distance from the centre at which the target still counts as hit. */
  radius: number;
  /** Ranking slots stop accepting drops once filled. */
  enabled: boolean;
};

/**
 * How close the finger is to a target, as 0 (far) to 1 (dead centre).
 *
 * Only ever used for the one target that would actually commit. Ramping every nearby
 * target at once lights up half the column and says nothing about where the answer will
 * land - which reads as several values being selected simultaneously.
 */
export function targetProximity(
  pointerX: number,
  pointerY: number,
  target: DropTarget,
  falloff: number
): number {
  "worklet";
  if (!target.enabled) return 0;
  const dx = pointerX - target.centerX;
  const dy = pointerY - target.centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance >= falloff) return 0;
  return 1 - distance / falloff;
}

/**
 * The target a release lands on, or null to spring back.
 *
 * Nearest-centre rather than first-match: targets sit close together in a column, and
 * picking the first one whose radius contains the point would bias every ambiguous drop
 * toward whichever end of the column happened to be checked first.
 */
export function resolveDropTarget(
  cardX: number,
  cardY: number,
  targets: readonly DropTarget[]
): DropTarget | null {
  "worklet";
  let best: DropTarget | null = null;
  let bestDistance = Infinity;

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i]!;
    if (!target.enabled) continue;
    const dx = cardX - target.centerX;
    const dy = cardY - target.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= target.radius && distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * Reads a ranking's slot map into the ordered array the API expects: index 0 is slot 1,
 * the best. Slots are filled in whatever order the evaluator chose to place cards, so the
 * map is not built in slot order and has to be read back in it.
 *
 * Returns null while any slot is still empty. A partial ranking is not a lesser answer,
 * it is one the API rejects outright, so it must never be submitted as if it were done.
 */
export function orderPlacements(
  placements: Record<number, string>,
  slotCount: number
): string[] | null {
  const ordered: string[] = [];
  for (let slot = 1; slot <= slotCount; slot += 1) {
    const id = placements[slot];
    if (id === undefined) return null;
    ordered.push(id);
  }
  return ordered;
}

/**
 * Which target is currently under the finger, by value, or 0 for none.
 *
 * Declared after resolveDropTarget on purpose: the worklets transform turns these into
 * const bindings, so calling one declared further down the file throws a temporal dead
 * zone error at bundle time rather than hoisting the way a plain function would.
 *
 * Deliberately the same nearest-enabled-within-radius rule as `resolveDropTarget`, so the
 * target that lights up during the drag is by construction the one a release commits to.
 * Two rules here would let the highlight promise one answer and the release record
 * another, which is the worst possible failure for a question the evaluator cannot review.
 */
export function activeTargetValue(
  pointerX: number,
  pointerY: number,
  targets: readonly DropTarget[]
): number {
  "worklet";
  const hit = resolveDropTarget(pointerX, pointerY, targets);
  return hit ? hit.value : 0;
}
