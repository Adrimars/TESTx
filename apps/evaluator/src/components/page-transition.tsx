"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PAGE_TRANSITION, REDUCED_MOTION_FADE_MS } from "@/lib/motion";

/**
 * Phase 20.2: a route change fades + rises the new page in, in the spirit of mobile's
 * CardStack entrance (Phase 12/16).
 *
 * Enter-only, deliberately without AnimatePresence/exit: Next's App Router already swaps
 * `children` to the new route's content in the same render that changes `routeKey`, so
 * there is no stable "old" element left for an exit animation to animate away - measured
 * live (the new page's text was already in the DOM ~60ms into what was meant to be a
 * 180ms exit). A `key` change on `motion.div` still fully remounts it, which is what
 * actually retriggers `initial` -> `animate` on every navigation.
 */
export function PageTransition({
  routeKey,
  children,
}: {
  routeKey: string;
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      key={routeKey}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: REDUCED_MOTION_FADE_MS / 1000 } : PAGE_TRANSITION}
    >
      {children}
    </motion.div>
  );
}
