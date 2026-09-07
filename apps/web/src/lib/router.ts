import { create } from 'zustand';

/**
 * URL routing. Screens, the catalogue class filter, and the selected flare id
 * all live in the URL so every view is deep-linkable and back/forward work:
 *
 *   /                        monitor
 *   /replay                  replay
 *   /catalogue               catalogue, all classes
 *   /catalogue?class=M       catalogue, M+ filter
 *   /catalogue/FLR-001       catalogue, detail pane for one flare
 *   /alerts  /methodology
 *
 * State lives in a zustand store rather than React state so any component
 * (rail nav, catalogue rows) can navigate without prop-drilling. The
 * popstate listener is installed once at module load.
 */

export type Screen = 'monitor' | 'replay' | 'catalogue' | 'alerts' | 'methodology';

const KNOWN_SCREENS: Screen[] = ['monitor', 'replay', 'catalogue', 'alerts', 'methodology'];
const KNOWN_CLASSES = ['ALL', 'X', 'M', 'C', 'B'] as const;

export interface Route {
  screen: Screen;
  /** Flare id from /catalogue/:id — drives the detail pane. */
  flareId: string | null;
  /** Catalogue class filter from ?class=. */
  minClass: (typeof KNOWN_CLASSES)[number];
}

export function parseLocation(pathname: string, search: string): Route {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0] as Screen | undefined;
  const screen = first && KNOWN_SCREENS.includes(first) ? first : 'monitor';

  const flareId =
    screen === 'catalogue' && segments[1] ? decodeURIComponent(segments[1]) : null;

  const classParam = new URLSearchParams(search).get('class');
  const minClass =
    classParam && (KNOWN_CLASSES as readonly string[]).includes(classParam)
      ? (classParam as Route['minClass'])
      : 'ALL';

  return { screen, flareId, minClass };
}

interface RouterState {
  route: Route;
  /** Push a URL. Pass { replace: true } for state-like updates. */
  go: (url: string, opts?: { replace?: boolean }) => void;
}

export const useRouter = create<RouterState>((set) => ({
  route: parseLocation(window.location.pathname, window.location.search),
  go: (url, opts) => {
    if (opts?.replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    set({ route: parseLocation(window.location.pathname, window.location.search) });
  },
}));

window.addEventListener('popstate', () => {
  useRouter.setState({ route: parseLocation(window.location.pathname, window.location.search) });
});

/** True when the click should be left to the browser (new tab / new window). */
export function isModifiedClick(e: React.MouseEvent): boolean {
  return e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}

/** URL for a catalogue view, preserving the class filter. */
export function catalogueUrl(flareId: string | null, minClass: string): string {
  const suffix = minClass === 'ALL' ? '' : `?class=${minClass}`;
  return flareId ? `/catalogue/${encodeURIComponent(flareId)}${suffix}` : `/catalogue${suffix}`;
}
