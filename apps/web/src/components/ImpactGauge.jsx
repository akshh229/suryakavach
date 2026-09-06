import React from 'react';
import { ShieldAlert, Radio, Satellite, Compass, UserCheck, AlertTriangle } from 'lucide-react';

export default function ImpactGauge({ impactData }) {
  const index = impactData?.index ?? 6.66;
  const severityBand = impactData?.severity_band || 'R3-R4';
  const rLevel = impactData?.r_level || 'R4';

  const getRColor = (lvl) => {
    switch (lvl) {
      case 'R5':
        return { text: 'text-red-500', bg: 'bg-red-500', title: 'Extreme Radio Blackout', desc: 'Complete HF radio blackout on entire sunlit side of Earth' };
      case 'R4':
        return { text: 'text-red-400', bg: 'bg-red-500', title: 'Severe Radio Blackout', desc: 'HF radio blackout on most sunlit side; satellite degradation' };
      case 'R3':
        return { text: 'text-orange-400', bg: 'bg-orange-500', title: 'Strong Radio Blackout', desc: 'Wide area blackout of HF radio; loss of radio contact for 1 hr' };
      case 'R2':
        return { text: 'text-amber-400', bg: 'bg-amber-500', title: 'Moderate Radio Blackout', desc: 'Limited blackout of HF radio; loss of radio contact' };
      case 'R1':
        return { text: 'text-yellow-400', bg: 'bg-yellow-500', title: 'Minor Radio Blackout', desc: 'Weak or minor degradation of HF radio signal' };
      default:
        return { text: 'text-emerald-400', bg: 'bg-emerald-500', title: 'No Space Weather Blackout', desc: 'Normal space weather operating conditions' };
    }
  };

  const rInfo = getRColor(rLevel);
  const indexPct = Math.min(Math.max((index / 10) * 100, 0), 100);

  const sectors = [
    {
      name: 'HF Communications',
      icon: Radio,
      risk: index >= 6 ? 'HIGH LOSS' : index >= 3 ? 'MODERATE' : 'NORMAL',
      statusColor: index >= 6 ? 'text-red-400 border-red-500/40 bg-red-500/10' : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
      desc: 'High-frequency ionospheric absorption active',
    },
    {
      name: 'Satellite Operations',
      icon: Satellite,
      risk: index >= 7 ? 'SURGE RISK' : index >= 4 ? 'ELEVATED' : 'NOMINAL',
      statusColor: index >= 7 ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
      desc: 'Orbit drag & single event upset monitoring',
    },
    {
      name: 'Astronaut EVA Radiation',
      icon: UserCheck,
      risk: index >= 6 ? 'SUSPEND EVA' : 'SAFE FOR EVA',
      statusColor: index >= 6 ? 'text-red-400 border-red-500/40 bg-red-500/10' : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
      desc: 'Proton flux radiation hazard threshold',
    },
    {
      name: 'GNSS / GPS Navigation',
      icon: Compass,
      risk: index >= 5 ? 'DEGRADED' : 'ACCURATE',
      statusColor: index >= 5 ? 'text-amber-400 border-amber-500/40 bg-amber-500/10' : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
      desc: 'Ionospheric total electron content fluctuation',
    },
  ];

  return (
    <div className="glass-panel p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <div>
            <h3 className="text-base font-bold text-slate-100">Radiation Impact Index & NOAA R-Scale</h3>
            <p className="text-xs text-slate-400">Fused SXR Peak, Hardness, Impulsivity, Duration Weighting</p>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono-val">
          <span className="text-xs text-slate-400">R-LEVEL:</span>
          <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${rInfo.text} bg-slate-900 border border-current`}>
            {rLevel} ({severityBand})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gauge & Index Score */}
        <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono-val">
              <span>SOLAR IMPACT INDEX (0-10)</span>
              <span className={`font-bold ${rInfo.text}`}>{rInfo.title}</span>
            </div>

            {/* Giant Score Display */}
            <div className="flex items-baseline gap-2 my-2">
              <span className={`text-5xl font-black font-mono-val tracking-tight ${rInfo.text}`}>
                {index.toFixed(2)}
              </span>
              <span className="text-slate-500 font-mono-val text-lg">/ 10.0</span>
            </div>

            {/* Linear Meter */}
            <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 my-3">
              <div
                className={`h-full ${rInfo.bg} rounded-full transition-all duration-700 shadow-lg`}
                style={{ width: `${indexPct}%` }}
              />
            </div>

            <p className="text-xs text-slate-300 mt-2">
              {rInfo.desc}
            </p>
          </div>

          {/* Sub-weights list */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono-val text-slate-400">
            <div>SXR Peak: <span className="text-slate-200">35%</span></div>
            <div>Spectral Hardness: <span className="text-slate-200">25%</span></div>
            <div>Impulsivity: <span className="text-slate-200">15%</span></div>
            <div>Duration: <span className="text-slate-200">15%</span></div>
          </div>
        </div>

        {/* Sector Impact Breakdown Grid */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sectors.map((sec, idx) => {
            const Icon = sec.icon;
            return (
              <div key={idx} className="bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-slate-200">{sec.name}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono-val ${sec.statusColor}`}>
                    {sec.risk}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{sec.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
