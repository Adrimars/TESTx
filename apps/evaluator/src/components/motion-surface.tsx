"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { ENTRANCE_SPRING, PRESS_SPRING } from "@/lib/motion";

/**
 * Phase 20.2's "button/card hover-focus states in the spirit of mobile's lib/motion.ts" -
 * local wrapper primitives rather than changes inside @testx/ui, since that package is
 * also read by apps/admin (out of scope for this phase, see plan.md Phase 20).
 *
 * Both respect prefers-reduced-motion the same way mobile's CardStack/RankingCard do:
 * transform (scale/y) never animates, the wrapped content just sits still.
 */

/** A primary call-to-action's press feedback: a small spring scale on hover/tap. Wraps a
 * @testx/ui Button - pass through its own width classes via `className` so layout doesn't
 * shift (e.g. `className="w-full sm:w-auto"` on the wrapper, `className="w-full"` still on
 * the Button itself). */
export function MotionPress({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={reducedMotion ? undefined : { scale: 1.015 }}
      whileTap={reducedMotion ? undefined : { scale: 0.985 }}
      transition={PRESS_SPRING}
    >
      {children}
    </motion.div>
  );
}

/** A card's hover-focus feedback: a light upward lift, mirroring mobile's entrance spring
 * shape rather than a CSS box-shadow hack. */
export function MotionLift({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={reducedMotion ? undefined : { y: -3 }}
      transition={ENTRANCE_SPRING}
    >
      {children}
    </motion.div>
  );
}
