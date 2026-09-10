import type { Transition } from "framer-motion";

/**
 * Desktop counterpart to apps/mobile/src/lib/motion.ts (prd.md §16.4/Phase 12), translated
 * from react-native-reanimated spring configs to Framer Motion transitions so both surfaces
 * move with the same rhythm despite the different animation engine. Values are chosen to
 * read the same as mobile's `damping`/`stiffness`/`mass` springs, not converted by formula.
 */

/** Card/dialog entrance and hover-lift: a light spring with a touch of overshoot. Mirrors
 * mobile's CARD_ENTRANCE_SPRING. */
export const ENTRANCE_SPRING: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 30,
  mass: 0.7,
};

/** Button/option press feedback: quicker and snappier than an entrance. Mirrors mobile's
 * CARD_REJECT_SPRING. */
export const PRESS_SPRING: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 22,
  mass: 0.6,
};

/** Page-to-page route transition: a plain fade+rise, deliberately not spring-driven - a
 * route change should feel immediate, not bouncy. */
export const PAGE_TRANSITION: Transition = { duration: 0.18, ease: "easeOut" };

/** Under prefers-reduced-motion (see PageTransition/MotionButton), every transition above
 * collapses to this instead - matches mobile's REDUCED_MOTION_FADE_MS exactly. */
export const REDUCED_MOTION_FADE_MS = 120;
