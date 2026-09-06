import { useState } from 'react';
import Plot from 'react-plotly.js';
import { ArrowLeft, Flame, ShieldCheck } from 'lucide-react';
import { useCatalogue, useFlareDetail } from '../lib/hooks';
import { goesClassColor } from '../lib/constants';
import type { CatalogueFlare } from '../types/api';

export default function FlareDetailView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data } = useCatalogue('A');
  const { data: detail } = useFlareDetail(selectedId);
  const flares = data?.items ?? [];

  const handleSelect = (flare: CatalogueFlare) => {
    setSelectedId(flare.id);
  };

  if (detail && selectedId) {
    const clsColor = goesClassColor(detail.peak_flux_sxr);
    const series = detail.series;
    const solexsX = series?.solexs.map((d) => d.t) ?? [];
    const solexsY = series?.solexs.map((d) => (d.v && d.v > 0 ? d.v : 1e-9));
    const hel1osX = series?.hel1os.map((d) => d.t) ?? [];
    const hel1osY = series?.hel1os.map((d) => (d.v && d.v > 0 ? d.v : 1e-10));
    const postX = series?.posterior.map((d) => d.t) ?? [];
    const postY = series?.posterior.map((d) => d.v ?? 0);

    return (
      <div className="sk-panel p-5">
        <button
          onClick={() => { setSelectedId(null); }}
          aria-label="Back to catalogue"
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-4 font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to catalogue
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl border-2" style={{ borderColor: clsColor }}>
            <span className="text-2xl font-black font-mono-val" style={{ color: clsColor }}>
              {detail.class}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              {detail.class.startsWith('X') || detail.class.startsWith('M') ? (
                <Flame className="w-5 h-5 text-red-500" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
              )}
              Flare {detail.id}
            </h2>
            <p className="text-xs text-slate-500 font-mono-val">
              Onset: {detail.onset} &nbsp;|&nbsp; Peak: {detail.peak}
            </p>
          </div>
        </div>

        {/* Time series chart */}
        {(solexsX.length > 0) && (
          <div className="mb-5 border border-slate-200 rounded-xl p-3">
            <Plot
              data={[
                { x: solexsX, y: solexsY, type: 'scatter', mode: 'lines', name: 'SoLEXS SXR', line: { color: '#06b6d4', width: 2 }, yaxis: 'y' },
                { x: hel1osX, y: hel1osY, type: 'scatter', mode: 'lines', name: 'HEL1OS HXR', line: { color: '#f97316', width: 1.5 }, yaxis: 'y2' },
                { x: postX, y: postY, type: 'scatter', mode: 'lines', name: 'BOCPD Posterior', line: { color: '#a855f7', width: 1.5, dash: 'dash' }, yaxis: 'y3' },
              ]}
              layout={{
                autosize: true, height: 320,
                margin: { l: 50, r: 50, t: 20, b: 30 },
                paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#f8fafc',
                font: { family: 'JetBrains Mono, monospace', size: 10, color: '#64748b' },
                xaxis: { gridcolor: '#e2e8f0' },
                yaxis: { type: 'log', range: [-8, -3], title: { text: 'SXR', font: { color: '#0284c7' } }, tickfont: { color: '#0284c7' }, gridcolor: '#e2e8f0' },
                yaxis2: { type: 'log', range: [-10, -4], title: { text: 'HXR', font: { color: '#ea580c' } }, tickfont: { color: '#ea580c' }, overlaying: 'y', side: 'right', showgrid: false },
                yaxis3: { range: [0, 1], title: { text: 'P(CP)', font: { color: '#a855f7' } }, tickfont: { color: '#a855f7' }, overlaying: 'y', side: 'right', position: 0.95, showgrid: false },
                showlegend: true, legend: { orientation: 'h', y: 1.1 },
              } as unknown as Partial<Plotly.Layout>}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%', height: '100%' }}
              useResizeHandler
            />
          </div>
        )}

        {/* Detail grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono-val text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-slate-400">SXR Peak</div>
            <div className="text-sky-600 mt-1 font-bold">{detail.peak_flux_sxr?.toExponential(3)} W/m²</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-slate-400">HXR Peak</div>
            <div className="text-amber-600 mt-1 font-bold">{detail.peak_flux_hxr?.toExponential(3)} W/m²</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-slate-400">Hardness</div>
            <div className="text-violet-600 mt-1 font-bold">{detail.hardness?.toFixed(3)}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-slate-400">Impulsivity</div>
            <div className="text-orange-600 mt-1 font-bold">{detail.impulsivity?.toFixed(2)}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-slate-400">Impact Index</div>
            <div className="text-red-600 mt-1 font-bold">{detail.impact_index?.toFixed(2)}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-slate-400">R-Level</div>
            <div className="text-red-600 mt-1 font-bold">{detail.r_level}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-slate-400">Detection</div>
            <div className="text-emerald-600 mt-1 font-bold">{detail.detection_method}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-slate-400">Posterior</div>
            <div className="text-violet-600 mt-1 font-bold">{detail.posterior?.toFixed(3)}</div>
          </div>
        </div>

        {detail.confidence && (
          <div className="mt-4 p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-700">
            {detail.confidence}
          </div>
        )}

        {detail.subscores && (
          <div className="mt-4">
            <h4 className="text-xs font-bold text-slate-600 mb-2">Impact Subscores</h4>
            <div className="grid grid-cols-4 gap-2 font-mono-val text-[11px]">
              {Object.entries(detail.subscores).map(([k, v]) => (
                <div key={k} className="bg-slate-50 p-2 rounded border border-slate-200">
                  <div className="text-slate-400">{k}</div>
                  <div className="text-slate-700 font-bold">{(v as number).toFixed(3)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="sk-panel p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <Flame className="w-5 h-5 text-amber-500" />
        <div>
          <h3 className="text-base font-bold text-slate-900">Flare Detail</h3>
          <p className="text-xs text-slate-500">Select a flare to inspect its time series and impact breakdown</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs font-mono-val">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Onset</th>
              <th className="p-3">Class</th>
              <th className="p-3 text-right">SXR Peak</th>
              <th className="p-3 text-right">Impact</th>
              <th className="p-3 text-center">R-Level</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
            {flares.map((row) => (
              <tr
                key={row.id}
                onClick={() => handleSelect(row)}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(row); }}
              >
                <td className="p-3 font-bold text-sky-600">{row.id}</td>
                <td className="p-3">{row.onset ? row.onset.replace('T', ' ').replace('Z', '') : '-'}</td>
                <td className="p-3 font-bold" style={{ color: goesClassColor(row.peak_flux_sxr) }}>{row.class}</td>
                <td className="p-3 text-right text-sky-600">{row.peak_flux_sxr?.toExponential(2)}</td>
                <td className="p-3 text-right text-amber-600">{row.impact_index?.toFixed(2)}</td>
                <td className="p-3 text-center">
                  <span className="px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-700 font-bold">{row.r_level}</span>
                </td>
                <td className="p-3 text-slate-400 text-right">→</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
