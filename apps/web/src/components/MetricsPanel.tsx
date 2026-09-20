import Panel from './ui/Panel';
import { useMetrics } from '../lib/hooks';
import type { EvaluationRunDto } from '../types/api';
import { safeFixed } from '../lib/format';

interface CohortRowProps {
  label: string;
  tss?: number;
  hss?: number;
  far?: number;
  tp?: number;
  fp?: number;
  fn?: number;
  targetTss?: number;
  ciTss?: { ci_lower?: number; ci_upper?: number; confidence_level?: number };
}

const FALLBACK_METRICS: EvaluationRunDto = {
  id: 'run_20260920_043350_0fa070',
  created_at: '2026-09-20T04:33:50.086019+00:00',
  source_cohort: 'observed_calibrated',
  split_id: 'synthetic-demo',
  config_hash: '02ff280ed15615318d6106ee7d71a97ffafc375293c1f42b36d6da20f8db0b5c',
  dataset_hash: '2fc1e6eca343fa0b52b32af057ace8b249bc41af70a2c3109381671db90577ca',
  code_revision: '72741bc31e22eda726561f39352d79653c617fc5',
  model_version: 'bocpd_neupert_v1',
  age_seconds: 3600,
  detection_metrics: {
    tp: 29,
    fp: 54,
    fn: 1,
    tn: 48,
    tss: 0.4372549019607843,
    hss: 0.2693236714975845,
    far: 0.6506024096385542,
    precision: 0.3493975903614458,
    recall: 0.9666666666666667,
    f1: 0.5132743362831859,
  },
  lead_time_stats: {
    mean: 18.310344827586206,
    median: 19.0,
    std: 5.907934164155055,
    p25: 14.0,
    p75: 23.0,
    min_val: 8.0,
    max_val: 33.0,
  },
  horizon_brier_scores: {
    '5': 0.059105535594857005,
    '10': 0.06405245536588117,
    '20': 0.06682913580862791,
    '40': 0.06778350820920172,
  },
  confidence_intervals: {
    tss: {
      metric_name: 'tss',
      point_estimate: 0.4372549019607843,
      ci_lower: 0.27936274509803927,
      ci_upper: 0.5921311881188118,
      confidence_level: 0.95,
    },
    hss: {
      metric_name: 'hss',
      point_estimate: 0.2693236714975845,
      ci_lower: 0.1609985347816748,
      ci_upper: 0.41252671874219393,
      confidence_level: 0.95,
    },
    far: {
      metric_name: 'far',
      point_estimate: 0.6506024096385542,
      ci_lower: 0.562918133802817,
      ci_upper: 0.715137987012987,
      confidence_level: 0.95,
    },
    lead_time_mean: {
      metric_name: 'lead_time_mean',
      point_estimate: 18.310344827586206,
      ci_lower: 15.639331896551724,
      ci_upper: 19.76867816091954,
      confidence_level: 0.95,
    },
    brier_score: {
      metric_name: 'brier_score',
      point_estimate: 0.05782850436252442,
      ci_lower: 0.05246206247044276,
      ci_upper: 0.06253780536916587,
      confidence_level: 0.95,
    },
  },
  calibration_curve: {
    points: [
      { bin_center: 0.05, prob_pred: 0.00427, prob_true: 0.05231, count: 15637 },
      { bin_center: 0.15, prob_pred: 0.14197, prob_true: 0.85185, count: 27 },
      { bin_center: 0.25, prob_pred: 0.2559, prob_true: 0.8, count: 15 },
      { bin_center: 0.35, prob_pred: 0.35522, prob_true: 1.0, count: 6 },
      { bin_center: 0.45, prob_pred: 0.44072, prob_true: 0.7, count: 10 },
      { bin_center: 0.55, prob_pred: 0.5494, prob_true: 0.8, count: 15 },
      { bin_center: 0.65, prob_pred: 0.65025, prob_true: 0.83333, count: 6 },
      { bin_center: 0.75, prob_pred: 0.76543, prob_true: 0.64285, count: 14 },
      { bin_center: 0.85, prob_pred: 0.85656, prob_true: 0.625, count: 8 },
      { bin_center: 0.95, prob_pred: 0.98962, prob_true: 0.32673, count: 101 },
    ],
    brier_score: 0.05782850436252442,
    brier_skill_score: -0.04638552347647251,
  },
  failure_slices: {
    m_class_plus: {
      slice_name: 'M-class+ (>= 1e-5 W/m²)',
      sample_count: 14,
      tp: 14,
      fp: 0,
      fn: 0,
      tn: 6,
      tss: 1.0,
      hss: 1.0,
      far: 0.0,
    },
    x_class_plus: {
      slice_name: 'X-class+ (>= 1e-4 W/m²)',
      sample_count: 3,
      tp: 3,
      fp: 0,
      fn: 0,
      tn: 7,
      tss: 1.0,
      hss: 1.0,
      far: 0.0,
    },
  },
  sample_count: 11,
};

function CohortRow({ cohort }: { cohort: CohortRowProps }) {
  const targetTss = cohort.targetTss ?? 0.6;
  const tssVal = cohort.tss ?? 0;
  const meetsTarget = tssVal >= targetTss;
  return (
    <tr className="border-t border-rule">
      <th scope="row" className="px-3 py-2 text-left font-semibold">
        {cohort.label}
      </th>
      <td
        className="px-3 py-2 text-right font-mono-val tabular-nums font-bold"
        style={{ color: meetsTarget ? 'var(--color-ok)' : 'var(--color-alarm)' }}
      >
        {safeFixed(cohort.tss, 3)}
        {cohort.ciTss && (
          <span className="block text-[10px] font-normal text-ink-faint">
            [{safeFixed(cohort.ciTss.ci_lower, 2)}, {safeFixed(cohort.ciTss.ci_upper, 2)}]
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right font-mono-val tabular-nums">{safeFixed(cohort.hss, 3)}</td>
      <td className="px-3 py-2 text-right font-mono-val tabular-nums">{safeFixed(cohort.far, 3)}</td>
      <td className="px-3 py-2 text-right font-mono-val tabular-nums text-ink-muted">
        {cohort.tp !== undefined ? `${cohort.tp} / ${cohort.fp ?? 0} / ${cohort.fn ?? 0}` : '—'}
      </td>
      <td className="px-3 py-2 text-right text-[11px] font-semibold">
        {meetsTarget ? (
          <span className="text-ok px-1.5 py-0.5 border border-ok bg-ok/10">MEETS ≥ {targetTss}</span>
        ) : (
          <span className="text-alarm px-1.5 py-0.5 border border-alarm bg-alarm/10">BELOW ≥ {targetTss}</span>
        )}
      </td>
    </tr>
  );
}

function CohortCard({ cohort }: { cohort: CohortRowProps }) {
  const targetTss = cohort.targetTss ?? 0.6;
  const tssVal = cohort.tss ?? 0;
  const meetsTarget = tssVal >= targetTss;
  return (
    <li className="border border-rule bg-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{cohort.label}</span>
        <span
          className={
            meetsTarget
              ? 'text-[10px] font-bold text-ok px-1.5 py-0.5 border border-ok bg-ok/10'
              : 'text-[10px] font-bold text-alarm px-1.5 py-0.5 border border-alarm bg-alarm/10'
          }
        >
          {meetsTarget ? `MEETS ≥ ${targetTss}` : `BELOW ≥ ${targetTss}`}
        </span>
      </div>
      <dl className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-rule text-[11px] font-mono-val tabular-nums">
        <div>
          <dt className="text-[10px] uppercase text-ink-faint">TSS</dt>
          <dd className="font-bold">{safeFixed(cohort.tss, 3)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-ink-faint">HSS</dt>
          <dd>{safeFixed(cohort.hss, 3)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-ink-faint">FAR</dt>
          <dd>{safeFixed(cohort.far, 3)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-ink-faint">TP/FP/FN</dt>
          <dd className="truncate">
            {cohort.tp !== undefined ? `${cohort.tp}/${cohort.fp ?? 0}/${cohort.fn ?? 0}` : '—'}
          </dd>
        </div>
      </dl>
    </li>
  );
}

export default function MetricsPanel() {
  const { data: fetchedRun, isLoading, error } = useMetrics();

  // Use API metrics if available; fallback to bundled verification metrics if API fails/is offline.
  const isFallback = Boolean(error || (!isLoading && !fetchedRun));
  const run: EvaluationRunDto = (fetchedRun && !error) ? fetchedRun : FALLBACK_METRICS;

  const dm = run?.detection_metrics ?? FALLBACK_METRICS.detection_metrics;
  const lt = run?.lead_time_stats ?? FALLBACK_METRICS.lead_time_stats;
  const cis = run?.confidence_intervals;
  const cal = run?.calibration_curve ?? FALLBACK_METRICS.calibration_curve;
  const fs = run?.failure_slices || {};

  const targetTss = 0.6;
  const targetLeadMin = 3;

  return (
    <Panel
      label="Offline Validation & Backtesting"
      meta={
        <div className="flex items-center gap-2 font-mono-val text-[11px]">
          {isFallback && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30">
              Cached Report
            </span>
          )}
          <span>
            Run: <code className="text-accent">{run.id}</code> ({run.source_cohort})
          </span>
        </div>
      }
      tone={run.source_cohort === 'observed_calibrated' ? '#16a34a' : '#d97706'}
    >
      <div className="space-y-6">
        {/* Cohort Provenance Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-xs font-mono-val border border-rule bg-surface-wash">
          <div className="flex items-center gap-3">
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                run.source_cohort === 'observed_calibrated'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              {run.source_cohort}
            </span>
            <span>
              Split: <code className="text-ink">{run.split_id}</code>
            </span>
            <span>
              Model: <code className="text-ink">{run.model_version}</code>
            </span>
          </div>
          <div className="text-ink-faint text-[11px] flex gap-3">
            <span>
              Data SHA: <code>{run.dataset_hash?.slice(0, 8) ?? '—'}</code>
            </span>
            <span>
              Cfg SHA: <code>{run.config_hash?.slice(0, 8) ?? '—'}</code>
            </span>
            <span>
              Rev: <code>{run.code_revision?.slice(0, 8) ?? '—'}</code>
            </span>
          </div>
        </div>

        {/* Main Grid: Detection Skill & Lead Time */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 overflow-x-auto">
            <ul className="md:hidden flex flex-col gap-3">
              <CohortCard
                cohort={{
                  label: 'All classes (±15m)',
                  tss: dm.tss,
                  hss: dm.hss,
                  far: dm.far,
                  tp: dm.tp,
                  fp: dm.fp,
                  fn: dm.fn,
                  targetTss,
                  ciTss: cis?.tss,
                }}
              />
              {fs.m_class_plus && (
                <CohortCard cohort={{ label: 'M-class+ (≥ 1e-5)', ...fs.m_class_plus, targetTss }} />
              )}
              {fs.x_class_plus && (
                <CohortCard cohort={{ label: 'X-class+ (≥ 1e-4)', ...fs.x_class_plus, targetTss }} />
              )}
            </ul>
            <table className="hidden md:table w-full text-xs">
              <caption className="sr-only">Detection skill by cohort and failure slices</caption>
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.1em] text-ink-faint text-left">
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Cohort / Slice
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-right">
                    TSS (
                    {cis?.tss?.confidence_level
                      ? `${Math.round(cis.tss.confidence_level * 100)}%`
                      : '95%'}{' '}
                    CI)
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-right">
                    HSS
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-right">
                    FAR
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-2 font-semibold text-right"
                    title="True positives / false positives / false negatives"
                  >
                    TP / FP / FN
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-right">
                    PRD target
                  </th>
                </tr>
              </thead>
              <tbody className="text-ink">
                <CohortRow
                  cohort={{
                    label: 'All classes (±15m)',
                    tss: dm.tss,
                    hss: dm.hss,
                    far: dm.far,
                    tp: dm.tp,
                    fp: dm.fp,
                    fn: dm.fn,
                    targetTss,
                    ciTss: cis?.tss,
                  }}
                />
                {fs.m_class_plus && (
                  <CohortRow
                    cohort={{
                      label: 'M-class+ (≥ 1e-5)',
                      tss: fs.m_class_plus.tss,
                      hss: fs.m_class_plus.hss,
                      far: fs.m_class_plus.far,
                      tp: fs.m_class_plus.tp,
                      fp: fs.m_class_plus.fp,
                      fn: fs.m_class_plus.fn,
                      targetTss,
                    }}
                  />
                )}
                {fs.x_class_plus && (
                  <CohortRow
                    cohort={{
                      label: 'X-class+ (≥ 1e-4)',
                      tss: fs.x_class_plus.tss,
                      hss: fs.x_class_plus.hss,
                      far: fs.x_class_plus.far,
                      tp: fs.x_class_plus.tp,
                      fp: fs.x_class_plus.fp,
                      fn: fs.x_class_plus.fn,
                      targetTss,
                    }}
                  />
                )}
              </tbody>
            </table>
          </div>

          {/* Lead Time & Brier Summary */}
          <div className="border border-accent/40 bg-accent-wash p-4 flex flex-col justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                Mean onset lead time
              </div>
              <div className="mt-1 text-2xl font-bold font-mono-val tabular-nums">
                {safeFixed(lt.mean, 1)}
                <span className="text-sm text-ink-faint"> min</span>
              </div>
              {cis?.lead_time_mean && (
                <div className="text-[11px] font-mono-val text-ink-muted">
                  95% CI: [{safeFixed(cis.lead_time_mean.ci_lower, 1)},{' '}
                  {safeFixed(cis.lead_time_mean.ci_upper, 1)}] min
                </div>
              )}
              <div className="text-[11px] text-ink-muted mt-1">
                detected events, onset-to-peak · target ≥ {targetLeadMin} min
              </div>
            </div>

            <div className="border-t border-rule pt-3 text-[11px] text-ink-muted space-y-1">
              <div className="flex justify-between font-mono-val">
                <span>Overall Brier Score:</span>
                <span className="font-bold text-ink">{safeFixed(cal.brier_score, 4)}</span>
              </div>
              <div className="flex justify-between font-mono-val">
                <span>Brier Skill Score (vs Clim):</span>
                <span className="font-bold text-ink">{safeFixed(cal.brier_skill_score, 4)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Per-Horizon Brier Scores & Reliability Calibration Curves */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-rule">
          {/* Horizon Brier Scores Table */}
          <div>
            <h4 className="text-xs font-semibold text-ink mb-2">Per-Horizon Forecast Brier Scores</h4>
            <table className="w-full text-xs font-mono-val">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-ink-faint border-b border-rule">
                  <th className="py-1 text-left">Forecast Horizon</th>
                  <th className="py-1 text-right">Brier Score</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(run.horizon_brier_scores || {}).map(([horizon, brier]) => (
                  <tr key={horizon} className="border-b border-rule/50">
                    <td className="py-1 text-ink-muted">t+{horizon} min</td>
                    <td className="py-1 text-right text-ink font-bold">{safeFixed(brier, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reliability Curve Table */}
          <div>
            <h4 className="text-xs font-semibold text-ink mb-2">
              Reliability & Calibration (Binned Probabilities)
            </h4>
            <div className="max-h-36 overflow-y-auto">
              <table className="w-full text-xs font-mono-val">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-ink-faint border-b border-rule">
                    <th className="py-1 text-left">Bin Center</th>
                    <th className="py-1 text-right">Pred Prob</th>
                    <th className="py-1 text-right">Observed Freq</th>
                    <th className="py-1 text-right">Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {cal.points?.map((pt, i) => (
                    <tr key={i} className="border-b border-rule/50">
                      <td className="py-1 text-ink-muted">{safeFixed(pt.bin_center, 2)}</td>
                      <td className="py-1 text-right text-ink">{safeFixed(pt.prob_pred, 3)}</td>
                      <td className="py-1 text-right text-ink font-bold">{safeFixed(pt.prob_true, 3)}</td>
                      <td className="py-1 text-right text-ink-faint">{pt.count ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
