import { useState } from 'react';
import { Database, Download, ChevronRight, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { CatalogueData, CatalogueFlare } from '../types/api';
import { goesClassColor } from '../lib/constants';

const FILTERS = ['ALL', 'X', 'M', 'C', 'B'] as const;

export default function FlareCatalogue() {
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [selectedFlare, setSelectedFlare] = useState<CatalogueFlare | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['catalogue', filterClass],
    queryFn: () =>
      api.get<CatalogueData>(
        `/api/flare/catalogue?min_class=${filterClass === 'ALL' ? 'A' : filterClass}&page_size=50`,
      ),
  });

  const flares = data?.items ?? [];

  const handleDownloadCsv = () => {
    window.location.href = '/api/flare/catalogue?format=csv';
  };

  return (
    <div className="sk-panel p-5">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <Database className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Solar Flare Detection Catalogue</h3>
            <p className="text-xs text-slate-500">Offline &amp; Simulated Event Detections Log</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-50 p-0.5 rounded-lg border border-slate-200 text-xs font-mono-val">
            {FILTERS.map((c) => (
              <button
                key={c}
                onClick={() => setFilterClass(c)}
                aria-pressed={filterClass === c}
                className={`px-3 py-1 rounded-md transition-all ${
                  filterClass === c
                    ? 'bg-amber-500 text-black font-bold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {c === 'ALL' ? 'ALL' : `${c}-Class`}
              </button>
            ))}
          </div>

          <button
            onClick={handleDownloadCsv}
            aria-label="Export catalogue as CSV"
            className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Flare Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs font-mono-val" role="grid" aria-label="Flare catalogue">
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-200">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Onset Time (UTC)</th>
              <th className="p-3">Peak Time</th>
              <th className="p-3">Class</th>
              <th className="p-3 text-right">SXR Peak (W/m²)</th>
              <th className="p-3 text-right">Hardness</th>
              <th className="p-3 text-right">Impulsivity</th>
              <th className="p-3 text-center">Impact Index</th>
              <th className="p-3 text-center">Detection Method</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-slate-400 font-sans">
                  Loading catalogue items...
                </td>
              </tr>
            ) : flares.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-slate-400 font-sans">
                  No flare events matching filter criteria.
                </td>
              </tr>
            ) : (
              flares.map((row) => {
                const cls = row.class || 'A0.0';
                const clsColor = goesClassColor(row.peak_flux_sxr);

                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedFlare(row)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSelectedFlare(row); }}
                  >
                    <td className="p-3 font-bold text-sky-600">{row.id}</td>
                    <td className="p-3">{row.onset ? row.onset.replace('T', ' ').replace('Z', '') : '-'}</td>
                    <td className="p-3">{row.peak ? row.peak.replace('T', ' ').replace('Z', '') : '-'}</td>
                    <td className="p-3 font-bold" style={{ color: clsColor }}>{cls}</td>
                    <td className="p-3 text-right text-sky-600">
                      {row.peak_flux_sxr ? row.peak_flux_sxr.toExponential(2) : '-'}
                    </td>
                    <td className="p-3 text-right text-violet-600">
                      {row.hardness ? row.hardness.toFixed(3) : '-'}
                    </td>
                    <td className="p-3 text-right text-orange-600">
                      {row.impulsivity ? row.impulsivity.toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                        {row.impact_index ? row.impact_index.toFixed(2) : '0.0'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 text-[10px] rounded bg-slate-50 text-slate-500 border border-slate-200">
                        {row.detection_method || 'BOCPD'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 text-right">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Detail View */}
      {selectedFlare && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Flare detail: ${selectedFlare.id}`}
          onKeyDown={(e) => { if (e.key === 'Escape') setSelectedFlare(null); }}
        >
          <div className="bg-white border border-slate-200 shadow-xl p-6 rounded-2xl max-w-xl w-full relative">
            <button
              onClick={() => setSelectedFlare(null)}
              aria-label="Close detail view"
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
              <span className="text-sky-600">Flare Detail:</span>
              <span className="font-mono-val">{selectedFlare.id}</span>
              <span
                className="px-2.5 py-0.5 rounded text-xs font-bold border"
                style={{
                  color: goesClassColor(selectedFlare.peak_flux_sxr),
                  borderColor: goesClassColor(selectedFlare.peak_flux_sxr),
                  backgroundColor: '#fff',
                }}
              >
                {selectedFlare.class}
              </span>
            </h3>

            <div className="grid grid-cols-2 gap-4 font-mono-val text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-slate-400">ONSET TIMESTAMP</div>
                <div className="text-slate-700 mt-1 font-bold">{selectedFlare.onset}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-slate-400">PEAK TIMESTAMP</div>
                <div className="text-slate-700 mt-1 font-bold">{selectedFlare.peak}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-slate-400">SXR PEAK FLUX</div>
                <div className="text-sky-600 mt-1 font-bold">{selectedFlare.peak_flux_sxr?.toExponential(3)} W/m²</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-slate-400">HXR PEAK FLUX</div>
                <div className="text-amber-600 mt-1 font-bold">{selectedFlare.peak_flux_hxr?.toExponential(3)} W/m²</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-slate-400">IMPACT INDEX / R-LEVEL</div>
                <div className="text-red-600 mt-1 font-bold">
                  {selectedFlare.impact_index?.toFixed(2)} ({selectedFlare.r_level})
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-slate-400">DETECTION ENGINE</div>
                <div className="text-violet-600 mt-1 font-bold">{selectedFlare.detection_method}</div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedFlare(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
