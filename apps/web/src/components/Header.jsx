import React from 'react';
import { Sun, Activity, ShieldAlert, Clock, Radio, Cpu } from 'lucide-react';

export default function Header({ healthData, clock }) {
  const utcTime = clock?.utc || new Date().toISOString().replace('.000', '');
  const istTime = clock?.ist || 'Calculated...';

  return (
    <header className="glass-panel border-b border-slate-800/80 px-6 py-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 p-0.5 shadow-lg shadow-orange-500/20">
            <div className="w-full h-full bg-[#080d1a] rounded-[10px] flex items-center justify-center">
              <Sun className="w-7 h-7 text-amber-400 animate-spin-slow" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-wider text-slate-100 uppercase">
                SURYAKAVACH
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                SIH26209
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Indigenous Solar-Flare Nowcast & Radiation Impact System (SoLEXS / HEL1OS)
            </p>
          </div>
        </div>

        {/* Status Indicators & Clock */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono-val">
          {/* Engines status */}
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>BOCPD Nowcast:</span>
              <span className="text-emerald-400 font-semibold">OK</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Forecast:</span>
              <span className="text-emerald-400 font-semibold">OK</span>
            </div>
          </div>

          {/* Clock */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <div>
              <span className="text-slate-400 mr-1">UTC:</span>
              <span className="text-slate-100 font-medium">{utcTime.split('T')[1]?.replace('Z', '') || utcTime}</span>
            </div>
          </div>

          {/* Mode */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-sans">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>LIVE REPLAY STREAM</span>
          </div>
        </div>
      </div>
    </header>
  );
}
