import { useEffect, useState } from 'react';

/**
 * Responsive primitives for the operator console.
 *
 * Breakpoints (mirroring Tailwind's sm/md/lg so CSS and JS never disagree):
 *   mobile   320–767px   — base styles, no prefix
 *   tablet   768–1023px  — `md:`
 *   desktop  ≥1024px     — `lg:`
 *
 * Everything here is matchMedia-based and evaluated inside an effect, never
 * from `window.innerWidth` during render: a render-time width read makes the
 * tree depend on a value React cannot observe, so the first paint after a
 * rotate/resize is wrong and hydration warnings follow. matchMedia gives a
 * change event, which is what a hook actually needs.
 */

export const MOBILE_QUERY = '(max-width: 767px)';
export const TABLET_QUERY = '(min-width: 768px) and (max-width: 1023px)';
export const DESKTOP_QUERY = '(min-width: 1024px)';
/** Touch devices — used to decide whether hover affordances are reachable. */
export const COARSE_POINTER_QUERY = '(hover: none) and (pointer: coarse)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

function match(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

/**
 * Subscribe to a media query. SSR/first-paint safe: the initialiser only
 * reports a match when a real matchMedia exists, and the effect re-syncs
 * immediately after mount (so a device whose query changes between the
 * initialiser and the effect still lands on the right value).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => match(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True below 768px. */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}

/** True between 768px and 1023px. */
export function useIsTablet(): boolean {
  return useMediaQuery(TABLET_QUERY);
}

/** True at 1024px and above. */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}

export function useBreakpoint(): Breakpoint {
  const mobile = useIsMobile();
  const tablet = useIsTablet();
  if (mobile) return 'mobile';
  if (tablet) return 'tablet';
  return 'desktop';
}

/** Touch-first device: skip hover-only affordances, prefer tap targets. */
export function useCoarsePointer(): boolean {
  return useMediaQuery(COARSE_POINTER_QUERY);
}

/**
 * Self-reported low-end signals. Deliberately narrow: 2GB, a dual-core CPU or
 * Save-Data. A typical laptop reporting 4 cores must still get the Scene.
 */
export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  const memory = nav.deviceMemory;
  const cores = nav.hardwareConcurrency;
  return (
    (typeof memory === 'number' && memory <= 2)
    || (typeof cores === 'number' && cores <= 2)
    || nav.connection?.saveData === true
  );
}

