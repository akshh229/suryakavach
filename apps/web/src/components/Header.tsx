import type { HealthStatus, Clock as ClockType } from '../types/api';

interface HeaderProps {
  health: HealthStatus | null;
  clock: ClockType | null;
  wsConnected: boolean;
}

function engineTone(status: string | undefined): string {
  if (!status) return 'var(--color-ink-faint)';
  if (status === 'ok' || status === 'ready') return 'var(--color-ok)';
  return 'var(--color-alarm)';
}

/**
 * Status strip: one hairline-ruled row of live console state — connection,
 * engines, stream mode, and the UTC/IST clock. Tabular numerals keep the
 * clock from jittering between ticks.
 */
export default function Header({ health, clock, wsConnected }: HeaderProps) {
  const utc = clock?.utc ?? '—';
  const ist = clock?.ist ?? '—';
  const utcDisplay = utc.includes('T') ? utc.split('T')[1]?.replace('Z', '') : utc;
  const istDisplay = ist.includes('T') ? ist.split('T')[1]?.replace('Z', '') : ist;

  return (
    <header className="bg-panel border-b border-rule sticky top-0 z-40">
      <div className="max-w-[1200px] mx-auto flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2 text-[11px] font-mono-val tabular-nums text-ink-muted">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: wsConnected ? 'var(--color-ok)' : 'var(--color-alarm)' }}
            aria-hidden="true"
          />
          <span className={wsConnected ? 'text-ok' : 'text-alarm'}>
            {wsConnected ? 'LINK' : 'NO LINK'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span>
            BOCPD <span style={{ color: engineTone(health?.engines?.nowcast) }}>{health?.engines?.nowcast ?? '—'}</span>
          </span>
          <span>
            FCST <span style={{ color: engineTone(health?.engines?.forecast) }}>{health?.engines?.forecast ?? '—'}</span>
          </span>
          <span>
            IMPACT <span style={{ color: engineTone(health?.engines?.impact) }}>{health?.engines?.impact ?? '—'}</span>
          </span>
        </div>

        <span className="text-ink">
          {health?.mode === 'replay' ? 'REPLAY' : 'LIVE'}
        </span>

        <div className="ml-auto flex items-center gap-4 text-ink">
          <span>
            <span className="text-ink-faint mr-1.5">UTC</span>
            {utcDisplay}
          </span>
          <span>
            <span className="text-ink-faint mr-1.5">IST</span>
            {istDisplay}
          </span>
        </div>
      </div>
    </header>
  );
}
