import { Bell, AlertTriangle, TrendingUp, Radio, Clock } from 'lucide-react';
import { useAlerts } from '../lib/hooks';
import type { Alert } from '../types/api';

const SEVERITY_ICONS: Record<string, typeof Bell> = {
  flare_onset: Radio,
  flare_peak: AlertTriangle,
  severity_increase: TrendingUp,
  forecast_high: Bell,
  data_gap: Clock,
};

const SEVERITY_COLORS: Record<string, string> = {
  R1: '#0284c7',
  R2: '#d97706',
  R3: '#ea580c',
  R4: '#dc2626',
  R5: '#991b1b',
};

export default function AlertCentre() {
  const { data, isLoading } = useAlerts();
  const alerts: Alert[] = data ?? [];

  return (
    <div className="sk-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <Bell className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Alert Centre</h3>
            <p className="text-xs text-slate-500">Live event, severity, and forecast alerts</p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-mono-val rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-bold">
          {alerts.length} alerts
        </span>
      </div>

      {isLoading ? (
        <div className="text-center text-slate-400 py-8 text-sm">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center text-slate-400 py-8 text-sm">No alerts in current session.</div>
      ) : (
        <div className="space-y-2" role="log" aria-live="polite" aria-label="Alert feed">
          {alerts.map((alert) => {
            const Icon = SEVERITY_ICONS[alert.type] ?? Bell;
            const color = SEVERITY_COLORS[alert.severity] ?? '#64748b';
            return (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              >
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                  style={{ backgroundColor: color + '15', color }}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="px-1.5 py-0.5 text-[10px] font-bold rounded border"
                      style={{ color, borderColor: color, backgroundColor: color + '10' }}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {alert.type.replace('_', ' ')}
                    </span>
                    {alert.flare_id && (
                      <span className="text-[10px] font-mono-val text-sky-600">{alert.flare_id}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700">{alert.message}</p>
                  <span className="text-[10px] text-slate-400 font-mono-val mt-0.5 block">
                    {alert.ts.replace('T', ' ').replace('Z', '')} UTC
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
