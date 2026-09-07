import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from './components/Header';
import OrbitMark from './components/ui/OrbitMark';
import NowcastBanner from './components/NowcastBanner';
import TelemetryChart from './components/TelemetryChart';
import ForecastCards from './components/ForecastCards';
import ImpactGauge from './components/ImpactGauge';
import FlareCatalogue from './components/FlareCatalogue';
import ReplayBar from './components/ReplayBar';
import MetricsPanel from './components/MetricsPanel';
import AlertCentre from './components/AlertCentre';
import Panel from './components/ui/Panel';
import { useReplayStore } from './store/replayStore';
import { useStreams, useNowcast, useForecast, useImpact, useHealth, useReplayDates } from './lib/hooks';
import { WS_URL } from './lib/constants';
import { useRouter, isModifiedClick } from './lib/router';
import type { Screen } from './lib/router';
import type { Clock } from './types/api';
import { screenFade, silkPress, staggerContainer, staggerItem, usePrefersReducedMotion } from './lib/motion';

const NAV: { screen: Screen; label: string; href: string }[] = [
  { screen: 'monitor', label: 'Monitor', href: '/' },
  { screen: 'replay', label: 'Replay', href: '/replay' },
  { screen: 'catalogue', label: 'Catalogue', href: '/catalogue' },
  { screen: 'alerts', label: 'Alerts', href: '/alerts' },
  { screen: 'methodology', label: 'Methodology', href: '/methodology' },
];

export default function App() {
  const { route, go } = useRouter();
  const reduced = usePrefersReducedMotion();
  const { setPlaying, setSpeed, setCursor, setEventDate, setDates, setMode } = useReplayStore();

  const [windowSize, setWindowSize] = useState(120);
  const [wsConnected, setWsConnected] = useState(false);
  const [clock, setClock] = useState<Clock | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number>(1000);

  // TanStack Query hooks for server state
  const { data: streams } = useStreams(windowSize);
  const { data: nowcastState } = useNowcast();
  const { data: forecast } = useForecast();
  const { data: impact } = useImpact();
  const { data: health } = useHealth();
  const { data: replayDates } = useReplayDates();

  // Wire replay dates into the store
  useEffect(() => {
    if (replayDates?.dates) setDates(replayDates.dates);
  }, [replayDates, setDates]);

  // WebSocket connection with exponential backoff
  const connectWS = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      reconnectRef.current = 1000;
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.heartbeat) return;
        if (payload.clock) setClock(payload.clock);
        if (payload.cursor_idx !== undefined) setCursor(payload.cursor_idx);
        if (payload.playing !== undefined) setPlaying(payload.playing);
        if (payload.speed !== undefined) setSpeed(payload.speed);
        if (payload.event_date) setEventDate(payload.event_date);
        if (payload.dates) setDates(payload.dates);
        if (payload.mode) setMode(payload.mode);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setTimeout(connectWS, reconnectRef.current);
      reconnectRef.current = Math.min(reconnectRef.current * 2, 30000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [setPlaying, setSpeed, setCursor, setEventDate, setDates, setMode]);

  useEffect(() => {
    connectWS();
    return () => wsRef.current?.close();
  }, [connectWS]);

  const handleWindowChange = (w: number) => {
    setWindowSize(w);
  };

  const renderScreen = () => {
    switch (route.screen) {
      case 'monitor':
        return (
          <motion.div
            className="space-y-4"
            variants={reduced ? undefined : staggerContainer}
            initial={reduced ? undefined : 'hidden'}
            animate={reduced ? undefined : 'show'}
          >
            <motion.div variants={reduced ? undefined : staggerItem}>
              <NowcastBanner nowcastState={nowcastState ?? null} />
            </motion.div>
            <motion.div variants={reduced ? undefined : staggerItem}>
              <TelemetryChart streams={streams ?? null} windowSize={windowSize} onWindowChange={handleWindowChange} />
            </motion.div>
            <motion.div variants={reduced ? undefined : staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ForecastCards forecast={forecast ?? null} />
              <ImpactGauge impact={impact ?? null} />
            </motion.div>
          </motion.div>
        );
      case 'catalogue':
        return <FlareCatalogue />;
      case 'replay':
        return (
          <>
            <NowcastBanner nowcastState={nowcastState ?? null} />
            <TelemetryChart streams={streams ?? null} windowSize={windowSize} onWindowChange={handleWindowChange} />
          </>
        );
      case 'alerts':
        return <AlertCentre />;
      case 'methodology':
        return (
          <Panel label="Methodology">
            <div className="text-sm text-ink-muted max-w-3xl">
              <p className="mb-4">
                SURYAKAVACH fuses the SoLEXS and HEL1OS payload streams from Aditya-L1 for
                real-time solar flare nowcasting. All data shown on this console is from the
                synthetic fused cache used for offline validation — not live Aditya-L1 telemetry.
              </p>
            </div>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-px bg-rule border border-rule">
              <div className="bg-panel p-4">
                <dt className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-muted">BOCPD Detection</dt>
                <dd className="text-xs text-ink-muted mt-2">
                  Bayesian Online Change-Point Detection identifies flux onset in real time,
                  producing the P(CP) posterior overlaid on the telemetry chart.
                </dd>
              </div>
              <div className="bg-panel p-4">
                <dt className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-muted">Logistic Hazard</dt>
                <dd className="text-xs text-ink-muted mt-2">
                  Calibrated discrete-time logistic hazard model forecasts flare probability over
                  multiple horizons, with EVT intensity quantiles.
                </dd>
              </div>
              <div className="bg-panel p-4">
                <dt className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-muted">Impact Fusion</dt>
                <dd className="text-xs text-ink-muted mt-2">
                  Weighted fusion of SXR peak, hardness, impulsivity, and duration into a 0–10
                  impact index mapped onto the NOAA R-scale.
                </dd>
              </div>
            </dl>
          </Panel>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-surface text-ink md:flex">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Left rail — brand, navigation, connection state */}
      <aside className="bg-panel border-b md:border-b-0 border-rule md:border-r md:w-[208px] md:shrink-0 md:sticky md:top-0 md:h-screen flex md:flex-col">
        <div className="px-4 py-3 md:py-4 border-b border-rule flex items-center gap-2.5">
          <OrbitMark size={22} />
          <div>
            <div className="text-sm font-bold tracking-[0.18em] uppercase">SURYAKAVACH</div>
            <div className="text-[10px] font-mono-val text-ink-faint mt-1">SIH26209 · ADITYA-L1</div>
          </div>
        </div>

        <nav
          className="flex md:flex-col gap-0.5 px-2 py-1.5 md:py-3 overflow-x-auto"
          aria-label="Main navigation"
        >
          {NAV.map(({ screen, label, href }) => {
            const active = route.screen === screen;
            return (
              <motion.a
                key={screen}
                href={href}
                aria-current={active ? 'page' : undefined}
                {...(reduced ? {} : silkPress)}
                onClick={(e) => {
                  if (isModifiedClick(e)) return;
                  e.preventDefault();
                  go(href);
                }}
                className={`whitespace-nowrap px-3 py-1.5 text-[13px] font-medium border-l-2 md:border-l-2 ${
                  active
                    ? 'text-accent bg-accent-wash border-accent'
                    : 'text-ink-muted border-transparent hover:text-ink'
                }`}
              >
                {label}
              </motion.a>
            );
          })}
        </nav>

        <div className="hidden md:block mt-auto px-4 py-3 border-t border-rule text-[10px] font-mono-val text-ink-faint space-y-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: wsConnected ? 'var(--color-ok)' : 'var(--color-alarm)' }}
              aria-hidden="true"
            />
            <span>WS {wsConnected ? 'CONNECTED' : 'OFFLINE'}</span>
          </div>
          <div>MODE {health?.mode?.toUpperCase() ?? '—'}</div>
          <div className="pt-1 text-ink-faint/70">SYNTHETIC CACHE — NOT LIVE ADITYA-L1</div>
        </div>
      </aside>

      {/* Content column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Header health={health ?? null} clock={clock} wsConnected={wsConnected} />

        <main id="main-content" className="flex-1 w-full max-w-[1200px] mx-auto p-4 space-y-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={route.screen}
              className="space-y-4"
              initial={reduced ? false : screenFade.initial}
              animate={reduced ? undefined : screenFade.animate}
              exit={reduced ? undefined : screenFade.exit}
              transition={reduced ? { duration: 0 } : screenFade.transition}
            >
              {renderScreen()}
              {route.screen === 'monitor' && <MetricsPanel />}
            </motion.div>
          </AnimatePresence>
        </main>

        <ReplayBar />
      </div>
    </div>
  );
}
