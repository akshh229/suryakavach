import type { ReactNode } from 'react';

interface MetricProps {
  label: string;
  value: ReactNode;
  /** Unit rendered after the value with a non-breaking space. */
  unit?: string;
  /** Explicit text colour (data colour) — defaults to ink. */
  tone?: string;
}

/** One labelled reading: tiny uppercase label, tabular monospace value. */
export default function Metric({ label, value, unit, tone }: MetricProps) {
  return (
    <div className="border-l border-rule pl-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">{label}</div>
      <div
        className="mt-0.5 text-sm font-mono-val tabular-nums leading-6"
        style={tone ? { color: tone } : undefined}
      >
        {value}
        {unit && <span className="text-ink-faint">{' '}{unit}</span>}
      </div>
    </div>
  );
}
