import { useEffect, useState } from 'react';
import type { Transition, Variants } from 'framer-motion';

/**
 * Motion tokens — a single "Silk" personality for the whole console:
 * smooth, composed, never bouncy. Spread these recipes onto motion.X
 * elements; never inline the transition values, so the feel stays in
 * one place.
 *
 * All timing is short (≤ 0.32s) to suit a dense instrument surface, and
 * every consumer must gate long-running/mount motion on
 * usePrefersReducedMotion — the global reduced-motion CSS rule kills
 * keyframe/transition-based motion, but framer-motion drives transforms
 * via JS and needs the explicit override.
 */

const SILK: Transition = { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.28 };
const SILK_FAST: Transition = { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.18 };

export const REDUCED_TRANSITION: Transition = { duration: 0 };

/** Panel / block entrance: rise + fade. */
export const silkEntrance = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: SILK,
} as const;

/** Screen crossfade for lateral (tab-to-tab) navigation. */
export const screenFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: SILK_FAST,
} as const;

/** Directional slide for hierarchical navigation (list → detail). */
export const detailSlide = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 16 },
  transition: SILK,
} as const;

/** Subtle hover lift for data cards. Pair with press for tactility. */
export const silkHover = {
  whileHover: { y: -2 },
  transition: SILK_FAST,
} as const;

/** Press feedback: a small, composed give. */
export const silkPress = {
  whileTap: { scale: 0.97 },
  transition: SILK_FAST,
} as const;

/** Stagger container: children cascade in gently. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: SILK },
};

/**
 * Reduced-motion hook. framer-motion has its own useReducedMotion, but
 * we keep a local one so components can pick a zero-duration transition
 * or skip typewriter/orbit motion entirely without importing two APIs.
 */
export function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
