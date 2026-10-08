import type { Transition, Variants } from "motion/react"

/**
 * Motion tokens — the TypeScript side of the values in globals.css.
 * Durations stay in the 150–350ms band for UI feedback; springs are for
 * anything the user drags, presses, or toggles.
 */
export const duration = { fast: 0.15, base: 0.24, slow: 0.35 } as const

export const easeOut = [0.2, 0.7, 0.3, 1] as const

export const spring: Transition = { type: "spring", stiffness: 400, damping: 30 }

export const tween: Transition = { duration: duration.base, ease: easeOut }

/** Parent of a staggered list or grid. */
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

/** Child of `stagger` — rises into place. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: tween },
}

/** Plain presence fade for mount/unmount under AnimatePresence. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.fast } },
  exit: { opacity: 0, transition: { duration: duration.fast } },
}
