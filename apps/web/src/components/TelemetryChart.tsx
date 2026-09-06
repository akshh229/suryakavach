import { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { Activity, Layers } from 'lucide-react';
import type { StreamsLatest } from '../types/api';
import { GOES_CLASSES } from '../lib/constants';

interface TelemetryChartProps {
  streams: StreamsLatest | null;
  windowSize: number;
  onWindowChange: (w: number) => void;
}

const WINDOWS = [60, 120, 360, 1440];

export default function TelemetryChart({ streams, windowSize, onWindowChange }: TelemetryChartProps) {
  const [showPosterior, setShowPosterior] = useState(true);

  const solexs = streams?.solexs ?? [];
  const hel1os = streams?.hel1os ?? [];
  const changepoints = streams?.changepoints ?? [];

  const { sxrX, sxrY, hxrX, hxrY, cpX, cpY } = useMemo(() => {
    const sxrX = solexs.map((d) => d.t);
    const sxrY = solexs.map((d) => (d.v && d.v > 0 ? d.v : 1e-9));
    const hxrX = hel1os.map((d) => d.t);
    const hxrY = hel1os.map((d) => (d.v && d.v > 0 ? d.v : 1e-10));

    const cpMap = new Map<string, number>();
    changepoints.forEach((cp) => cpMap.set(cp.t, cp.p));
    const cpX: string[] = [];
    const cpY: number[] = [];
    solexs.forEach((d) => {
      if (cpMap.has(d.t)) {
        cpX.push(d.t);
        cpY.push(cpMap.get(d.t)!);
      }
    });

    return { sxrX, sxrY, hxrX, hxrY, cpX, cpY };
  }, [solexs, hel1os, changepoints]);

  const layout = useMemo(
    () => ({
      autosize: true,
      height: 400,
      margin: { l: 60, r: 60, t: 20, b: 40 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: '#f8fafc',
      font: { family: 'JetBrains Mono, monospace', size: 10, color: '#64748b' },
      xaxis: {
        gridcolor: '#e2e8f0',
        zerolinecolor: '#cbd5e1',
        tickangle: 0,
        nticks: 12,
      },
      yaxis: {
        type: 'log',
        range: [-8, -3],
        title: { text: 'SXR Flux (W/m²)', font: { color: '#0284c7' } },
        tickfont: { color: '#0284c7' },
        gridcolor: '#e2e8f0',
        zerolinecolor: '#cbd5e1',
        tickvals: [1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3],
        ticktext: ['A', 'B', 'C', 'M', 'X', 'X10'],
      },
      yaxis2: {
        type: 'log',
        range: [-10, -4],
        title: { text: 'HXR Flux (W/m²)', font: { color: '#ea580c' } },
        tickfont: { color: '#ea580c' },
        overlaying: 'y',
        side: 'right',
        showgrid: false,
      },
      showlegend: true,
      legend: { orientation: 'h', y: 1.1, font: { size: 11, color: '#475569' } },
      shapes: GOES_CLASSES.slice(1).map((cls) => ({
        type: 'line',
        xref: 'paper',
        x0: 0,
        x1: 1,
        y0: cls.threshold,
        y1: cls.threshold,
        yref: 'y',
        line: { color: cls.color, width: 1, dash: 'dot' },
      })),
    }),
    [],
  ) as unknown as Partial<Plotly.Layout>;

  const data: Plotly.Data[] = [
    {
      x: sxrX,
      y: sxrY,
      type: 'scatter',
      mode: 'lines',
      name: 'SoLEXS SXR',
      line: { color: '#06b6d4', width: 2 },
      fill: 'tozeroy',
      fillcolor: 'rgba(6, 182, 212, 0.08)',
      yaxis: 'y',
    },
    {
      x: hxrX,
      y: hxrY,
      type: 'scatter',
      mode: 'lines',
      name: 'HEL1OS HXR',
      line: { color: '#f97316', width: 1.8 },
      yaxis: 'y2',
    },
    ...(showPosterior && cpX.length > 0
      ? [
          {
            x: cpX,
            y: cpY,
            type: 'scatter' as const,
            mode: 'lines' as const,
            name: 'BOCPD P(CP)',
            line: { color: '#a855f7', width: 1.5, dash: 'dash' },
            yaxis: 'y',
            yaxis_ref: 'y' as const,
          },
        ]
      : []),
  ];

  return (
    <div className="sk-panel p-5 flex flex-col h-[460px]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-sky-500" />
          <h3 className="text-base font-bold text-slate-900">Solar X-Ray Telemetry Stream (Aditya-L1)</h3>
          <span className="px-2 py-0.5 text-[10px] font-mono-val bg-sky-50 text-sky-700 border border-sky-200 rounded">
            {solexs.length} pts
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPosterior(!showPosterior)}
            aria-pressed={showPosterior}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showPosterior
                ? 'bg-violet-50 text-violet-700 border-violet-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>BOCPD P(CP)</span>
          </button>

          <div className="flex items-center bg-slate-50 p-0.5 rounded-lg border border-slate-200 text-xs font-mono-val">
            {WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => onWindowChange(w)}
                aria-pressed={windowSize === w}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  windowSize === w ? 'bg-amber-500 text-black font-bold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {w >= 60 ? `${w / 60}h` : `${w}m`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0 relative">
        <Plot
          data={data}
          layout={layout}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-200 text-[11px] text-slate-500 font-mono-val">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-sans font-medium">GOES Scale:</span>
          {GOES_CLASSES.map((cls) => (
            <span key={cls.label} style={{ color: cls.color }}>
              {cls.label} ({cls.threshold.toExponential(0)})
            </span>
          ))}
        </div>
        <div className="text-slate-400">
          Dual Payloads: SoLEXS (0.5–10 Å) &amp; HEL1OS (10–150 keV)
        </div>
      </div>
    </div>
  );
}
