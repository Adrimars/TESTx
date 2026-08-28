import * as Haptics from "expo-haptics";

/**
 * Shared `react-native-reanimated` presets (prd.md §16.4), defined once so every
 * card/target component animates the same way rather than each hand-rolling its own
 * timing. `SwipeCard` (the one gesture surface every question type renders through)
 * consumes the drag-release presets; `CardStack` reads `CARD_ENTRANCE_SPRING` for its
 * own peek-to-active transition; a target column (Rating/Ranking) reads `commitHaptic`
 * directly.
 */

/** Card reject: spring back to center with a small overshoot on a release short of the
 * commit threshold. Damping under ~20 with this stiffness is what produces the overshoot -
 * a critically damped spring would just stop at center instead of settling past it. */
export const CARD_REJECT_SPRING = { damping: 18, stiffness: 220, mass: 0.7 } as const;

/** Card commit: fast fly-off in the release direction, ~220ms per prd.md §16.4. */
export const CARD_COMMIT_MS = 180;

/** Popup entrance: scale + fade in with spring overshoot (prd.md §16.4's test-complete
 * popup). Lower damping than the card-reject spring - a popup only plays this once, so a
 * more pronounced overshoot reads as celebratory rather than jittery. */
export const POPUP_ENTRANCE_SPRING = { damping: 14, stiffness: 180, mass: 0.9 } as const;

/** Card-stack entrance: the same rising/scaling/fading shape as the popup spring above,
 * but tuned tighter - the popup travels a whole screen's worth of scale+fade, this only
 * closes a couple of peek steps (a few px of translate, a few % of scale), so the popup's
 * overshoot would read as a jitter rather than a rise at this distance (prd.md §16.2). */
export const CARD_ENTRANCE_SPRING = { damping: 22, stiffness: 260, mass: 0.7 } as const;

/** Under OS Reduce Motion (prd.md §16.4/§16.7), every spring above collapses to this
 * instead - an instant/short fade, never a translate/rotate/scale/overshoot. */
export const REDUCED_MOTION_FADE_MS = 120;

/** A light tick, fired the moment a drag crosses a target's commit threshold (prd.md
 * §16.4's Rating/Ranking proximity spec) - not at final release, which already has its
 * own commit animation. Swallows the rejection expo-haptics raises on hardware/simulators
 * without a haptics engine, since missing a tick there is silent-safe. */
export function triggerTargetHaptic(): void {
  Haptics.selectionAsync().catch(() => undefined);
}
