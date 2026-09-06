import React from 'react';
import { ShieldAlert, TrendingUp, Clock, AlertCircle } from 'lucide-react';

export default function ForecastCards({ forecastData }) {
  const horizons = forecastData?.horizons || [
    { horizon_min: 5, p_c1: 0.12, p_m1: 0.03 },
    { horizon_min: 10, p_c1: 0.22, p_m1: 0.08 },
    { horizon_min: 20, p_c1: 0.45, p_m1: 0.18 },
    { horizon_min: 40, p_c1: 0.76, p_m1: 0.42 },
  ];

  const getRiskColor = (prob) => {
    if (prob >= 0.5) return { text: 'text-red-400', bg: 'bg-red-500', border: 'border-red-500/40', badge: 'HIGH RISK' };
    if (prob >= 0.2) return { text: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500/40', badge: 'ELEVATED' };
    return { text: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500/30', badge: 'NOMINAL' };
  };

  return (
    <div className="glass-panel p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-base font-bold text-slate-100">Multi-Horizon Flare Hazard Forecast</h3>
            <p className="text-xs text-slate-400">Calibrated Discrete-Time Logistic Hazard Model</p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-mono-val rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Logistic Hazard Engine
        </span>
      </div>

      {/* Grid of Horizon Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {horizons.map((item) => {
          const riskM = getRiskColor(item.p_m1);
          const pctC1 = Math.round(item.p_c1 * 100);
          const pctM1 = Math.round(item.p_m1 * 100);

          return (
            <div
              key={item.horizon_min}
              className={`bg-slate-900/70 border ${riskM.border} p-4 rounded-xl relative overflow-hidden transition-all duration-300 hover:translate-y-[-2px]`}
            >
              {/* Top Horizon Badge */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 font-mono-val text-slate-300 font-bold">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>+{item.horizon_min} Min Horizon</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${riskM.text} bg-slate-950 border border-current`}>
                  {riskM.badge}
                </span>
              </div>

              {/* Probabilities Breakdown */}
              <div className="space-y-3 font-mono-val">
                {/* M+ Flare Probability */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-sans">P(M+ Flare Class):</span>
                    <span className={`font-bold ${riskM.text}`}>{pctM1}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${riskM.bg} transition-all duration-500`}
                      style={{ width: `${pctM1}%` }}
                    />
                  </div>
                </div>

                {/* C+ Flare Probability */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 font-sans">P(C+ Flare Class):</span>
                    <span className="text-slate-300 font-bold">{pctC1}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 transition-all duration-500"
                      style={{ width: `${pctC1}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom indicator */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Hazard Rate λ(t)</span>
                <span className="font-mono-val text-slate-300">{(item.p_m1 / (item.horizon_min || 1)).toFixed(4)}/m</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
