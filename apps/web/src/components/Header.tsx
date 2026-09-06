import { Sun, Activity, Clock, Cpu, Wifi } from 'lucide-react';
import type { HealthStatus, Clock as ClockType } from '../types/api';

interface HeaderProps {
  health: HealthStatus | null;
  clock: ClockType | null;
  wsConnected: boolean;
}

export default function Header({ health, clock, wsConnected }: HeaderProps) {
  const utcTime = clock?.utc ?? '—';
  const istTime = clock?.ist ?? '—';
  const utcDisplay = utcTime.includes('T') ? utcTime.split('T')[1]?.replace('Z', '') : utcTime;
  const istDisplay = istTime.includes('T') ? istTime.split('T')[1]?.replace('Z', '') : istTime;

  return (
    <header className="sk-panel border-b border-slate-200 px-6 py-4 sticky top-0 z-50 rounded-none">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 p-0.5 shadow-lg shadow-orange-500/20">
            <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
              <Sun className="w-7 h-7 text-amber-500" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-wider text-slate-900 uppercase">SURYAKAVACH</h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider rounded bg-amber-50 text-amber-700 border border-amber-200">
                SIH26209
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Indigenous Solar-Flare Nowcast &amp; Radiation Impact System (SoLEXS / HEL1OS)
            </p>
          </div>
        </div>

        {/* Status Indicators & Clock */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono-val">
          {/* WS Connection */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-sans"
            style={{
              color: wsConnected ? '#16a34a' : '#dc2626',
              borderColor: wsConnected ? '#86efac' : '#fca5a5',
              backgroundColor: wsConnected ? '#f0fdf4' : '#fef2f2',
            }}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>{wsConnected ? 'WS Connected' : 'WS Disconnected'}</span>
          </div>

          {/* Engines status */}
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Cpu className="w-3.5 h-3.5 text-sky-500" />
              <span>BOCPD:</span>
              <span className="text-emerald-600 font-semibold">
                {health?.engines?.nowcast ?? '—'}
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Activity className="w-3.5 h-3.5 text-amber-500" />
              <span>Forecast:</span>
              <span className="text-emerald-600 font-semibold">
                {health?.engines?.forecast ?? '—'}
              </span>
            </div>
          </div>

          {/* Clock */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <div>
              <span className="text-slate-400 mr-1">UTC:</span>
              <span className="text-slate-700 font-medium">{utcDisplay}</span>
            </div>
            <span className="text-slate-300">|</span>
            <div>
              <span className="text-slate-400 mr-1">IST:</span>
              <span className="text-slate-700 font-medium">{istDisplay}</span>
            </div>
          </div>

          {/* Mode */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-sans">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{health?.mode === 'replay' ? 'REPLAY STREAM' : 'LIVE STREAM'}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
