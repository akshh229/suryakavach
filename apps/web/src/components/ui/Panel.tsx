import type { ReactNode } from 'react';

interface PanelProps {
  /** Uppercase letter-spaced label shown on the panel's top rule. */
  label: string;
  /** Right-aligned slot on the label rule: counts, badges, small controls. */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * The one panel chrome in the console: a hairline-ruled box titled by a
 * single uppercase label. No icon, no subtitle, no shadow.
 */
export default function Panel({ label, meta, children, className = '' }: PanelProps) {
  return (
    <section className={`sk-panel ${className}`}>
      <header className="flex items-center justify-between gap-4 px-4 py-2 border-b border-rule">
        <h2 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-muted">
          {label}
        </h2>
        {meta && (
          <div className="flex items-center gap-3 text-[11px] font-mono-val text-ink-faint">
            {meta}
          </div>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
