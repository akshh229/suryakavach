import React from 'react';
import { AlertTriangle, Zap, ShieldCheck, Flame, Radio, Activity } from 'lucide-react';

export default function NowcastBanner({ nowcastState, activeFlare, impactCurrent }) {
  const state = nowcastState?.state || 'quiet';
  const active = activeFlare || nowcastState?.active;

  const getStateBadge = (s) => {
    switch (s?.toLowerCase()) {
      case 'onset':
        return { label: 'FLARE ONSET DETECTED', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40', animate: true };
      case 'rising':
        return { label: 'RAPID FLUX RISE (RISING)', bg: 'bg-orange-600/20 text-orange-400 border-orange-500/40', animate: true };
      case 'peak':
        return { label: 'PEAK INTENSITY REACHED', bg: 'bg-red-600/30 text-red-300 border-red-500/60', animate: true };
      case 'decay':
        return { label: 'DECAY PHASE', bg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', animate: false };
      default:
        return { label: 'QUIET / BACKGROUND', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', animate: false };
    }
  };

  const badge = getStateBadge(state);
  const flareClass = active?.class || 'A0.0';
  const isMajor = flareClass.startsWith('X') || flareClass.startsWith('M');

  return (
    <div className={`glass-panel p-5 rounded-2xl transition-all duration-300 ${isMajor ? 'glass-panel-glow-red' : 'glass-panel-glow-amber'}`}>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        
        {/* Left Status & Class Badge */}
        <div className="flex items-center gap-5">
          {/* Flare Class Box */}
          <div className={`relative flex flex-col items-center justify-center min-w-24 h-24 rounded-xl border p-3 text-center ${
            flareClass.startsWith('X')
              ? 'bg-gradient-to-b from-red-950/80 to-red-900/60 border-red-500/60 shadow-lg shadow-red-600/30'
              : flareClass.startsWith('M')
              ? 'bg-gradient-to-b from-amber-950/80 to-amber-900/60 border-amber-500/60 shadow-lg shadow-amber-600/20'
              : 'bg-slate-900/80 border-slate-700/60'
          }`}>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">GOES CLASS</span>
            <span className={`text-3xl font-black font-mono-val tracking-tight ${
              flareClass.startsWith('X') ? 'text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]' :
              flareClass.startsWith('M') ? 'text-amber-400' : 'text-slate-200'
            }`}>
              {flareClass}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">SoLEXS Peak</span>
          </div>

          {/* State Text & Description */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`px-3 py-1 rounded-full text-xs font-bold tracking-wider border flex items-center gap-2 ${badge.bg}`}>
                {badge.animate && <span className="w-2 h-2 rounded-full bg-current animate-ping" />}
                <span>{badge.label}</span>
              </div>
              {active?.id && (
                <span className="text-xs font-mono-val text-slate-400">ID: {active.id}</span>
              )}
            </div>

            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              {isMajor ? (
                <>
                  <Flame className="w-5 h-5 text-red-500 animate-bounce" />
                  <span>High-Energy Solar Flare Event Active</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Solar Radiation Baseline Monitor</span>
                </>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              BOCPD online change-point detection & Neupert effect cross-correlation on Aditya-L1 payload streams.
            </p>
          </div>
        </div>

        {/* Telemetry Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto font-mono-val">
          <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 uppercase">SXR Flux (0.5–10 Å)</div>
            <div className="text-sm font-bold text-cyan-400 mt-1">
              {active?.peak_flux_sxr ? active.peak_flux_sxr.toExponential(2) : '1.24e-06'} <span className="text-[10px] text-slate-500 font-sans">W/m²</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 uppercase">HXR Flux (10–150 keV)</div>
            <div className="text-sm font-bold text-amber-400 mt-1">
              {active?.peak_flux_hxr ? active.peak_flux_hxr.toExponential(2) : '3.12e-07'} <span className="text-[10px] text-slate-500 font-sans">W/m²</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 uppercase">Spectral Hardness</div>
            <div className="text-sm font-bold text-purple-400 mt-1">
              {active?.hardness ? active.hardness.toFixed(3) : '0.045'}
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 uppercase">Impulsivity Index</div>
            <div className="text-sm font-bold text-orange-400 mt-1">
              {active?.impulsivity ? active.impulsivity.toFixed(2) : '2.14'}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
