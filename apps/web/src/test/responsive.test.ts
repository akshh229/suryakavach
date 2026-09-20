import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHook, act } from '@testing-library/react';

const CSS = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../index.css'), 'utf8');
import {
  MOBILE_QUERY,
  TABLET_QUERY,
  DESKTOP_QUERY,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useBreakpoint,
} from '../lib/responsive';
import { installMatchMedia, type MatchMediaHarness } from './matchMedia';

let mm: MatchMediaHarness;

function install(initial: Record<string, boolean>) {
  mm = installMatchMedia(initial);
}

afterEach(() => {
  // jsdom has no matchMedia of its own; leave the global clean for other files.
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

describe('responsive breakpoint queries', () => {
  it('agrees with the CSS breakpoints used by Tailwind', () => {
    expect(MOBILE_QUERY).toBe('(max-width: 767px)');
    expect(TABLET_QUERY).toBe('(min-width: 768px) and (max-width: 1023px)');
    expect(DESKTOP_QUERY).toBe('(min-width: 1024px)');
  });

  it('reports a phone viewport as mobile, not desktop', () => {
    install({ [MOBILE_QUERY]: true, [DESKTOP_QUERY]: false, [TABLET_QUERY]: false });
    const { result } = renderHook(() => ({
      mobile: useIsMobile(),
      tablet: useIsTablet(),
      desktop: useIsDesktop(),
      breakpoint: useBreakpoint(),
    }));
    expect(result.current.mobile).toBe(true);
    expect(result.current.tablet).toBe(false);
    expect(result.current.desktop).toBe(false);
    expect(result.current.breakpoint).toBe('mobile');
  });

  it('reports a 768–1023px viewport as tablet', () => {
    install({ [MOBILE_QUERY]: false, [TABLET_QUERY]: true, [DESKTOP_QUERY]: false });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('tablet');
  });

  it('reports a wide viewport as desktop', () => {
    install({ [MOBILE_QUERY]: false, [TABLET_QUERY]: false, [DESKTOP_QUERY]: true });
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe('desktop');
  });

  it('reacts to a rotation without a remount', () => {
    install({ [MOBILE_QUERY]: true, [DESKTOP_QUERY]: false });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
    act(() => {
      mm.set(MOBILE_QUERY, false);
    });
    expect(result.current).toBe(false);
  });

  it('falls back to desktop when matchMedia is unavailable', () => {
    // jsdom without the harness — the same path a very old browser takes.
    delete (window as unknown as { matchMedia?: unknown }).matchMedia;
    const { result } = renderHook(() => ({
      mobile: useIsMobile(),
      desktop: useIsDesktop(),
    }));
    expect(result.current.mobile).toBe(false);
    expect(result.current.desktop).toBe(false);
  });
});

/* The whole application surface, minus the tests that assert on it. */
const SOURCES = import.meta.glob(
  [
    '../App.tsx',
    '../main.tsx',
    '../lib/**/*.ts',
    '../components/**/*.tsx',
    '../store/**/*.ts',
    '../hooks/**/*.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** A comment may name the forbidden API; only code counts. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('render-time window access', () => {
  /* The brief forbids reading window.innerWidth during render. This is a
     source check rather than a behavioural one because the failure mode — a
     layout that disagrees with the media queries until the next resize — is
     invisible in a single jsdom render, where matchMedia does not exist. */
  it('scans the real application surface', () => {
    const files = Object.keys(SOURCES);
    expect(files.length).toBeGreaterThan(15);
    expect(files.some((f) => f.endsWith('/responsive.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('/LandingHero.tsx'))).toBe(true);
  });

  for (const [path, src] of Object.entries(SOURCES)) {
    it(`${path} reads no viewport width during render`, () => {
      expect(stripComments(src)).not.toMatch(/\binnerWidth\b|\binnerHeight\b/);
    });
  }
});

describe('touch-target class contract', () => {
  it('grows .sk-touch to 44px below 768px only', () => {
    expect(CSS).toMatch(/\.sk-touch \{\s*min-height: 32px/);
    expect(CSS).toMatch(/@media \(max-width: 767px\) \{\s*\.sk-touch \{\s*min-height: 44px/);
  });

  it('stacks the bottom sheet and keeps it scrollable', () => {
    expect(CSS).toMatch(/\.sk-sheet-body \{[^}]*flex: 1 1 auto[^}]*min-height: 0/);
    expect(CSS).toMatch(/\.sk-scroll-locked/);
  });
});

beforeEach(() => {
  install({});
});
