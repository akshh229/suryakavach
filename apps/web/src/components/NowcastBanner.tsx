import type { NowcastState, ActiveFlare } from '../types/api';
import { NOWCAST_STATES, goesClassColor, rLevelColor } from '../lib/constants';
import Metric from './ui/Metric';
import Typewriter from './ui/Typewriter';

interface NowcastBannerProps {
  nowcastState: NowcastState | null;
}

/**
 * Primary status readout. With no active flare every numeric field shows an
 * em dash — never a plausible-looking placeholder, which would read as real
 * telemetry.
 */
export default function NowcastBanner({ nowcastState }: NowcastBannerProps) {
  const state = nowcastState?.state || 'quiet';
  const active: ActiveFlare | null = nowcastState?.active ?? null;
  const stateInfo = NOWCAST_STATES[state];
  const flareClass = active?.class ?? '—';
  const isMajor = flareClass.startsWith('X') || flareClass.startsWith('M');
  const stateTone = active ? stateInfo.color : 'var(--color-ink-faint)';

  return (
    <div
      className={`sk-panel ${isMajor ? 'border-l-2 border-l-alarm' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 p-4">
        {/* State + active flare identity */}
        <div className="flex items-center gap-5 min-w-0">
          <div className="flex flex-col items-center justify-center w-24 h-20 border border-rule px-2 text-center shrink-0">
            <span className="text-[10px] uppercase tracking-[0.14em] text-ink-faint">GOES class</span>
            <span
              className="text-2xl font-bold font-mono-val tabular-nums leading-8"
              style={{ color: active ? goesClassColor(active.peak_flux_sxr) : 'var(--color-ink-faint)' }}
            >
              {flareClass}
            </span>
            <span className="text-[10px] font-mono-val text-ink-faint">SoLEXS peak</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span
                className="px-2 py-0.5 text-[11px] font-bold tracking-[0.1em] border font-mono-val"
                style={{ color: stateTone, borderColor: stateTone }}
              >
                {stateInfo.label.toUpperCase()}
              </span>
              {active?.id && (
                <span className="text-[11px] font-mono-val text-ink-muted">ID {active.id}</span>
              )}
            </div>
            <h1 className="text-base font-semibold leading-6">
              <Typewriter
                text={
                  active
                    ? isMajor
                      ? 'High-energy solar flare event active'
                      : 'Solar flare event in progress'
                    : 'Solar radiation baseline — no active flare'
                }
              />
            </h1>
            <p className="text-[11px] text-ink-muted mt-0.5">
              BOCPD online change-point detection &amp; Neupert-effect cross-correlation on Aditya-L1 payload streams.
            </p>
          </div>
        </div>

        {/* Active flare telemetry */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto">
          <Metric
            label="SXR 0.5–10 Å"
            value={active?.peak_flux_sxr ? active.peak_flux_sxr.toExponential(2) : '—'}
            unit={active?.peak_flux_sxr ? 'W/m²' : undefined}
          />
          <Metric
            label="HXR 10–150 keV"
            value={active?.peak_flux_hxr ? active.peak_flux_hxr.toExponential(2) : '—'}
            unit={active?.peak_flux_hxr ? 'W/m²' : undefined}
          />
          <Metric label="Spectral hardness" value={active?.hardness ? active.hardness.toFixed(3) : '—'} />
          <Metric label="Impulsivity" value={active?.impulsivity ? active.impulsivity.toFixed(2) : '—'} />
          <Metric label="Severity band" value={active?.severity_band ?? '—'} />
          <Metric
            label="R-level"
            value={active?.r_level ?? '—'}
            tone={active ? rLevelColor(active.index) : undefined}
          />
        </div>
      </div>
    </div>
  );
}
