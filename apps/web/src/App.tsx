import { useEffect, useRef, useCallback, useState } from 'react';
import Header from './components/Header';
import NowcastBanner from './components/NowcastBanner';
import TelemetryChart from './components/TelemetryChart';
import ForecastCards from './components/ForecastCards';
import ImpactGauge from './components/ImpactGauge';
import FlareCatalogue from './components/FlareCatalogue';
import ReplayBar from './components/ReplayBar';
import MetricsPanel from './components/MetricsPanel';
import AlertCentre from './components/AlertCentre';
import FlareDetailView from './components/FlareDetailView';
import { useUIStore } from './store/uiStore';
import { useReplayStore } from './store/replayStore';
import { useStreams, useNowcast, useForecast, useImpact, useHealth, useReplayDates } from './lib/hooks';
import { WS_URL } from './lib/constants';
import type { Clock } from './types/api';

export default function App() {
  const { activeScreen } = useUIStore();
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
    switch (activeScreen) {
      case 'monitor':
        return (
          <>
            <NowcastBanner nowcastState={nowcastState ?? null} />
            <TelemetryChart streams={streams ?? null} windowSize={windowSize} onWindowChange={handleWindowChange} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ForecastCards forecast={forecast ?? null} />
              <ImpactGauge impact={impact ?? null} />
            </div>
          </>
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
      case 'detail':
        return <FlareDetailView />;
      case 'methodology':
        return (
          <div className="sk-panel p-8">
            <h2 className="text-lg font-bold text-slate-700 mb-4">Methodology</h2>
            <p className="text-sm text-slate-600 mb-4">
              SURYAKAVACH fuses SoLEXS and HEL1OS payload streams from Aditya-L1 for real-time solar flare nowcasting.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <h3 className="font-bold text-slate-700 mb-1">BOCPD Detection</h3>
                <p className="text-slate-500">Bayesian Online Change-Point Detection identifies flux onset in real time.</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <h3 className="font-bold text-slate-700 mb-1">Logistic Hazard</h3>
                <p className="text-slate-500">Calibrated discrete-time logistic hazard model forecasts flare probability over multiple horizons.</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <h3 className="font-bold text-slate-700 mb-1">Impact Fusion</h3>
                <p className="text-slate-500">Weighted fusion of SXR peak, hardness, impulsivity, and duration into a 0-10 impact index.</p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-sky-50 text-slate-900 flex flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Header health={health ?? null} clock={clock} wsConnected={wsConnected} />

      {/* Screen Navigation */}
      <nav className="max-w-7xl w-full mx-auto px-4 pt-4" aria-label="Main navigation">
        <div className="flex gap-1 flex-wrap">
          {(['monitor', 'replay', 'catalogue', 'alerts', 'detail', 'methodology'] as const).map((s) => (
            <button
              key={s}
              onClick={() => useUIStore.getState().setScreen(s)}
              aria-current={activeScreen === s ? 'page' : undefined}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors capitalize ${
                activeScreen === s
                  ? 'bg-white border-amber-500 text-slate-900'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </nav>

      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-6">
        {renderScreen()}
        {activeScreen === 'monitor' && <MetricsPanel />}
      </main>

      <ReplayBar />
    </div>
  );
}
