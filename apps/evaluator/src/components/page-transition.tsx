"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PAGE_TRANSITION, REDUCED_MOTION_FADE_MS } from "@/lib/motion";

/**
 * Phase 20.2: a route change fades + rises the new page in, in the spirit of mobile's
 * CardStack entrance (Phase 12/16). `mode="wait"` so the old page fully exits before the
 * new one enters - a crossfade would double-render two pages' worth of data fetches
 * fighting for the same header/scroll position.
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
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={
          reducedMotion
            ? { duration: REDUCED_MOTION_FADE_MS / 1000 }
            : PAGE_TRANSITION
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
