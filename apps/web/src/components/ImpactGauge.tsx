import { ShieldAlert, Radio, Satellite, Compass, UserCheck } from 'lucide-react';
import type { ImpactCurrent } from '../types/api';
import { rLevelColor, IMPACT_WEIGHTS } from '../lib/constants';

interface ImpactGaugeProps {
  impact: ImpactCurrent | null;
}

const R_INFO: Record<string, { title: string; desc: string }> = {
  R5: { title: 'Extreme Radio Blackout', desc: 'Complete HF radio blackout on entire sunlit side of Earth' },
  R4: { title: 'Severe Radio Blackout', desc: 'HF radio blackout on most sunlit side; satellite degradation' },
  R3: { title: 'Strong Radio Blackout', desc: 'Wide area blackout of HF radio; loss of radio contact for 1 hr' },
  R2: { title: 'Moderate Radio Blackout', desc: 'Limited blackout of HF radio; loss of radio contact' },
  R1: { title: 'Minor Radio Blackout', desc: 'Weak or minor degradation of HF radio signal' },
  R0: { title: 'No Space Weather Blackout', desc: 'Normal space weather operating conditions' },
};

export default function ImpactGauge({ impact }: ImpactGaugeProps) {
  const index = impact?.index ?? 0;
  const rLevel = impact?.r_level ?? 'R0';
  const rInfo = R_INFO[rLevel] ?? R_INFO.R0;
  const color = rLevelColor(index);
  const indexPct = Math.min(Math.max((index / 10) * 100, 0), 100);

  const sectors = [
    {
      name: 'HF Communications',
      icon: Radio,
      risk: index >= 6 ? 'HIGH LOSS' : index >= 3 ? 'MODERATE' : 'NORMAL',
      active: index >= 6,
      desc: 'High-frequency ionospheric absorption active',
    },
    {
      name: 'Satellite Operations',
      icon: Satellite,
      risk: index >= 7 ? 'SURGE RISK' : index >= 4 ? 'ELEVATED' : 'NOMINAL',
      active: index >= 7,
      desc: 'Orbit drag & single event upset monitoring',
    },
    {
      name: 'Astronaut EVA Radiation',
      icon: UserCheck,
      risk: index >= 6 ? 'SUSPEND EVA' : 'SAFE FOR EVA',
      active: index >= 6,
      desc: 'Proton flux radiation hazard threshold',
    },
    {
      name: 'GNSS / GPS Navigation',
      icon: Compass,
      risk: index >= 5 ? 'DEGRADED' : 'ACCURATE',
      active: index >= 5,
      desc: 'Ionospheric total electron content fluctuation',
    },
  ];

  return (
    <div className="sk-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Radiation Impact Index & NOAA R-Scale</h3>
            <p className="text-xs text-slate-500">Fused SXR Peak, Hardness, Impulsivity, Duration Weighting</p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono-val">
          <span className="text-xs text-slate-500">R-LEVEL:</span>
          <span
            className="px-2.5 py-1 text-xs font-bold rounded-lg border"
            style={{ color, borderColor: color, backgroundColor: '#fff' }}
          >
            {rLevel} ({impact?.band ?? '—'})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gauge & Index Score */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-mono-val">
              <span>SOLAR IMPACT INDEX (0-10)</span>
              <span className="font-bold" style={{ color }}>{rInfo.title}</span>
            </div>

            <div className="flex items-baseline gap-2 my-2">
              <span className="text-5xl font-black font-mono-val tracking-tight" style={{ color }}>
                {index.toFixed(2)}
              </span>
              <span className="text-slate-400 font-mono-val text-lg">/ 10.0</span>
            </div>

            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden my-3">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${indexPct}%`, backgroundColor: color }}
              />
            </div>

            <p className="text-xs text-slate-600 mt-2">{rInfo.desc}</p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 grid grid-cols-2 gap-2 text-[11px] font-mono-val text-slate-500">
            <div>SXR Peak: <span className="text-slate-700">{Math.round(IMPACT_WEIGHTS.peak_sxr * 100)}%</span></div>
            <div>Spectral Hardness: <span className="text-slate-700">{Math.round(IMPACT_WEIGHTS.hardness * 100)}%</span></div>
            <div>Impulsivity: <span className="text-slate-700">{Math.round(IMPACT_WEIGHTS.impulsivity * 100)}%</span></div>
            <div>Duration: <span className="text-slate-700">{Math.round(IMPACT_WEIGHTS.duration * 100)}%</span></div>
          </div>
        </div>

        {/* Sector Impact Breakdown Grid */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sectors.map((sec) => {
            const Icon = sec.icon;
            return (
              <div key={sec.name} className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-sky-500" />
                    <span className="text-xs font-bold text-slate-700">{sec.name}</span>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded border font-mono-val"
                    style={{
                      color: sec.active ? '#dc2626' : '#16a34a',
                      borderColor: sec.active ? '#fca5a5' : '#86efac',
                      backgroundColor: sec.active ? '#fef2f2' : '#f0fdf4',
                    }}
                  >
                    {sec.risk}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{sec.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
