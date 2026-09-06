import { TrendingUp, Clock } from 'lucide-react';
import type { ForecastData, ForecastHorizon } from '../types/api';
import { riskColor, riskLevel } from '../lib/constants';

interface ForecastCardsProps {
  forecast: ForecastData | null;
}

export default function ForecastCards({ forecast }: ForecastCardsProps) {
  const horizons = forecast?.horizons ?? [];

  return (
    <div className="sk-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <TrendingUp className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Multi-Horizon Flare Hazard Forecast</h3>
            <p className="text-xs text-slate-500">Calibrated Discrete-Time Logistic Hazard Model</p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-mono-val rounded-md bg-amber-50 text-amber-700 border border-amber-200">
          Logistic Hazard Engine
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {horizons.map((item) => (
          <HorizonCard key={item.horizon_min} horizon={item} />
        ))}
      </div>
    </div>
  );
}

function HorizonCard({ horizon }: { horizon: ForecastHorizon }) {
  const pctC1 = Math.round(horizon.p_c1 * 100);
  const pctM1 = Math.round(horizon.p_m1 * 100);
  const level = riskLevel(horizon.p_m1);
  const color = riskColor(horizon.p_m1);
  const badgeLabel = level === 'extreme' ? 'HIGH RISK' : level === 'high' ? 'ELEVATED' : level === 'moderate' ? 'MODERATE' : 'NOMINAL';

  return (
    <div
      className="bg-slate-50 border border-slate-200 p-4 rounded-xl relative overflow-hidden transition-all duration-300 hover:translate-y-[-2px] hover:shadow-md"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 font-mono-val text-slate-700 font-bold">
          <Clock className="w-4 h-4 text-amber-500" />
          <span>+{horizon.horizon_min} Min Horizon</span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ color, borderColor: color, backgroundColor: '#fff' }}>
          {badgeLabel}
        </span>
      </div>

      <div className="space-y-3 font-mono-val">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-600 font-sans">P(M+ Flare Class):</span>
            <span className="font-bold" style={{ color }}>{pctM1}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${pctM1}%`, backgroundColor: color }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500 font-sans">P(C+ Flare Class):</span>
            <span className="text-slate-700 font-bold">{pctC1}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-500 transition-all duration-500"
              style={{ width: `${pctC1}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
        <span>Hazard Rate λ(t)</span>
        <span className="font-mono-val text-slate-700">{(horizon.p_m1 / (horizon.horizon_min || 1)).toFixed(4)}/m</span>
      </div>
    </div>
  );
}
