import { Flame, ShieldCheck } from 'lucide-react';
import type { NowcastState, ActiveFlare } from '../types/api';
import { NOWCAST_STATES, goesClassColor } from '../lib/constants';

interface NowcastBannerProps {
  nowcastState: NowcastState | null;
}

export default function NowcastBanner({ nowcastState }: NowcastBannerProps) {
  const state = nowcastState?.state || 'quiet';
  const active: ActiveFlare | null = nowcastState?.active ?? null;
  const stateInfo = NOWCAST_STATES[state];
  const flareClass = active?.class || 'A0.0';
  const isMajor = flareClass.startsWith('X') || flareClass.startsWith('M');

  return (
    <div
      className={`sk-panel p-5 transition-all duration-300 ${isMajor ? 'border-red-300' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left Status & Class Badge */}
        <div className="flex items-center gap-5">
          {/* Flare Class Box */}
          <div
            className={`relative flex flex-col items-center justify-center min-w-24 h-24 rounded-xl border p-3 text-center ${
              flareClass.startsWith('X')
                ? 'bg-red-50 border-red-300'
                : flareClass.startsWith('M')
                ? 'bg-amber-50 border-amber-300'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">GOES CLASS</span>
            <span
              className="text-3xl font-black font-mono-val tracking-tight"
              style={{ color: goesClassColor(active?.peak_flux_sxr ?? 0) }}
            >
              {flareClass}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">SoLEXS Peak</span>
          </div>

          {/* State Text & Description */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="px-3 py-1 rounded-full text-xs font-bold tracking-wider border flex items-center gap-2"
                style={{ color: stateInfo.color, borderColor: stateInfo.color, backgroundColor: stateInfo.bg }}
              >
                {state !== 'quiet' && state !== 'decay' && (
                  <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                )}
                <span>{stateInfo.label.toUpperCase()}</span>
              </div>
              {active?.id && (
                <span className="text-xs font-mono-val text-slate-500">ID: {active.id}</span>
              )}
            </div>

            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              {isMajor ? (
                <>
                  <Flame className="w-5 h-5 text-red-500" />
                  <span>High-Energy Solar Flare Event Active</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span>Solar Radiation Baseline Monitor</span>
                </>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              BOCPD online change-point detection &amp; Neupert effect cross-correlation on Aditya-L1 payload streams.
            </p>
          </div>
        </div>

        {/* Telemetry Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto font-mono-val">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase">SXR Flux (0.5–10 Å)</div>
            <div className="text-sm font-bold text-sky-600 mt-1">
              {active?.peak_flux_sxr ? active.peak_flux_sxr.toExponential(2) : '1.24e-06'}{' '}
              <span className="text-[10px] text-slate-400 font-sans">W/m²</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase">HXR Flux (10–150 keV)</div>
            <div className="text-sm font-bold text-amber-600 mt-1">
              {active?.peak_flux_hxr ? active.peak_flux_hxr.toExponential(2) : '3.12e-07'}{' '}
              <span className="text-[10px] text-slate-400 font-sans">W/m²</span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase">Spectral Hardness</div>
            <div className="text-sm font-bold text-violet-600 mt-1">
              {active?.hardness ? active.hardness.toFixed(3) : '0.045'}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
            <div className="text-[10px] text-slate-500 uppercase">Impulsivity Index</div>
            <div className="text-sm font-bold text-orange-600 mt-1">
              {active?.impulsivity ? active.impulsivity.toFixed(2) : '2.14'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
