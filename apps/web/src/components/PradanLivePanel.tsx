import { useEffect, useState } from 'react';
import Panel from './ui/Panel';
import {
  usePradanStatus,
  usePradanPoll,
  usePradanDiscover,
  usePradanSchedule,
} from '../lib/hooks';

/**
 * PRADAN live-ingest panel: the diff poller's old-vs-new analytics, refreshed
 * every 5 s, plus on-demand Discover / Download / Ingest actions.
 *
 * Additive by contract, both ends: the server manifest only ever gains
 * entries, and the file list below only ever gains names (a `Set` merged on
 * every poll — reconnects and refetches can never drop history).
 */
export default function PradanLivePanel() {
  const { data: status, isPending, isError } = usePradanStatus();
  const poll = usePradanPoll();
  const discover = usePradanDiscover();
  const schedule = usePradanSchedule();
  const [known, setKnown] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  // Merge every poll's filenames into the additive local list.
  useEffect(() => {
    if (!status) return;
    const fresh = [...(status.new_files ?? []), ...(status.pending ?? [])];
    if (fresh.length === 0) return;
    setKnown((prev) => {
      const seen = new Set(prev);
      const add = fresh.filter((f) => !seen.has(f));
      return add.length > 0 ? [...add, ...prev] : prev;
    });
  }, [status]);

  const busy = poll.isPending || discover.isPending;

  const runPoll = () => {
    setNote(null);
    poll.mutate(
      {},
      {
        onSuccess: (r) =>
          setNote(
            r.new_count > 0
              ? `+${r.new_count} new file(s), ${r.new_mb.toFixed(2)} MB`
              : `No new files — ${r.old_count} on disk (${r.old_mb.toFixed(2)} MB)`,
          ),
        onError: (e) => setNote(`Poll failed: ${e.message}`),
      },
    );
  };

  const runDownload = () => {
    setNote(null);
    poll.mutate(
      { fetch_defaults: true },
      {
        onSuccess: (r) =>
          setNote(
            `Downloaded ${r.fetched.downloaded_count} · skipped ${r.fetched.skipped_count} (already on disk)`,
          ),
        onError: (e) => setNote(`Download failed: ${e.message}`),
      },
    );
  };

  const runDiscover = () => {
    setNote(null);
    discover.mutate(undefined, {
      onSuccess: (r) =>
        setNote(
          r.new_count > 0
            ? `PRADAN lists ${r.listed} file(s), ${r.new_count} unseen`
            : `PRADAN lists ${r.listed} file(s) — all already seen`,
        ),
      onError: (e) => setNote(`Discover failed: ${e.message}`),
    });
  };

  const toggleSchedule = () => {
    setNote(null);
    if (status?.schedule.scheduled) {
      schedule.stop.mutate(undefined, {
        onSuccess: () => setNote('Auto-watch stopped — data kept'),
        onError: (e) => setNote(`Stop failed: ${e.message}`),
      });
    } else {
      schedule.start.mutate(30, {
        onSuccess: (s) =>
          setNote(`Auto-watch on: discover → download → diff every ${s.interval_min} min`),
        onError: (e) => setNote(`Start failed: ${e.message}`),
      });
    }
  };

  const meta = status ? (
    <span aria-live="polite">
      OLD {status.old_count} · NEW {status.new_count} · {status.total_mb.toFixed(1)} MB
    </span>
  ) : undefined;

  return (
    <Panel label="PRADAN Live Ingest" meta={meta} tone="#0ea5e9">
      {isPending && <p className="text-[11px] font-mono-val text-ink-faint">Loading ingest state…</p>}
      {isError && (
        <p className="text-[11px] font-mono-val text-alarm">
          Ingest API unreachable — start the backend to enable live intake.
        </p>
      )}
      {status && (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono-val tabular-nums">
            <div className="border border-rule p-2">
              <dt className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">Old files</dt>
              <dd className="mt-0.5 text-base font-bold">{status.old_count}</dd>
            </div>
            <div className="border border-rule p-2">
              <dt className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">New files</dt>
              <dd className="mt-0.5 text-base font-bold text-ok">{status.new_count}</dd>
            </div>
            <div className="border border-rule p-2">
              <dt className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">Total size</dt>
              <dd className="mt-0.5 text-base font-bold">{status.total_mb.toFixed(1)} MB</dd>
            </div>
            <div className="border border-rule p-2">
              <dt className="text-[10px] uppercase tracking-[0.1em] text-ink-faint">Polls</dt>
              <dd className="mt-0.5 text-base font-bold">{status.polls}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runPoll}
              disabled={busy}
              className="sk-touch px-2.5 py-1.5 text-[11px] font-semibold border border-rule hover:border-accent-soft transition-colors disabled:opacity-50"
            >
              Check now
            </button>
            <button
              type="button"
              onClick={runDiscover}
              disabled={busy}
              className="sk-touch px-2.5 py-1.5 text-[11px] font-semibold border border-rule hover:border-accent-soft transition-colors disabled:opacity-50"
            >
              Check PRADAN listing
            </button>
            <button
              type="button"
              onClick={runDownload}
              disabled={busy}
              className="sk-touch px-2.5 py-1.5 text-[11px] font-semibold border border-ok text-ok bg-ok/10 hover:bg-ok/20 transition-colors disabled:opacity-50"
            >
              Download unseen
            </button>
            <button
              type="button"
              onClick={toggleSchedule}
              disabled={busy}
              className={`sk-touch px-2.5 py-1.5 text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                status?.schedule.scheduled
                  ? 'border-ok text-ok bg-ok/10 hover:bg-ok/20'
                  : 'border-rule hover:border-accent-soft'
              }`}
            >
              {status?.schedule.scheduled
                ? `Auto-watch on (${status.schedule.interval_min} min)`
                : 'Auto-watch off'}
            </button>
          </div>

          {note && (
            <p aria-live="polite" className="text-[11px] font-mono-val text-ink-muted">
              {note}
            </p>
          )}

          {known.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-ink-faint mb-1">
                Files seen ({known.length})
              </div>
              <ul className="max-h-32 overflow-y-auto border border-rule divide-y divide-rule text-[11px] font-mono-val">
                {known.map((f) => (
                  <li key={f} className="px-2 py-1 truncate" title={f}>
                    {f.split('/').pop()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] font-mono-val text-ink-faint">
            Raw L1 intake only — calibration into the science pipeline stays an explicit step.
          </p>
        </div>
      )}
    </Panel>
  );
}
