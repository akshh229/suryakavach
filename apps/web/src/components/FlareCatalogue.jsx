import React, { useState, useEffect } from 'react';
import { Database, Download, Filter, Search, ChevronRight, X } from 'lucide-react';

export default function FlareCatalogue() {
  const [flares, setFlares] = useState([]);
  const [filterClass, setFilterClass] = useState('ALL');
  const [selectedFlare, setSelectedFlare] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCatalogue();
  }, [filterClass]);

  const fetchCatalogue = async () => {
    setLoading(true);
    try {
      const minClass = filterClass === 'ALL' ? 'A' : filterClass;
      const res = await fetch(`/api/flare/catalogue?min_class=${minClass}&page_size=50`);
      const data = await res.json();
      setFlares(data?.data?.items || []);
    } catch (err) {
      console.error('Failed to fetch catalogue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCsv = () => {
    window.location.href = '/api/flare/catalogue?format=csv';
  };

  return (
    <div className="glass-panel p-5 rounded-2xl">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2.5">
          <Database className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="text-base font-bold text-slate-100">Solar Flare Detection Catalogue</h3>
            <p className="text-xs text-slate-400">Offline & Simulated Event Detections Log</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Tabs */}
          <div className="flex items-center bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-xs font-mono-val">
            {['ALL', 'X', 'M', 'C', 'B'].map((c) => (
              <button
                key={c}
                onClick={() => setFilterClass(c)}
                className={`px-3 py-1 rounded-md transition-all ${
                  filterClass === c
                    ? 'bg-amber-500 text-black font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {c === 'ALL' ? 'ALL' : `${c}-Class`}
              </button>
            ))}
          </div>

          {/* Download CSV Button */}
          <button
            onClick={handleDownloadCsv}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Flare Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs font-mono-val">
          <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] border-b border-slate-800">
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
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/40 text-slate-200">
            {loading ? (
              <tr>
                <td colSpan="10" className="p-6 text-center text-slate-500 font-sans">
                  Loading catalogue items...
                </td>
              </tr>
            ) : flares.length === 0 ? (
              <tr>
                <td colSpan="10" className="p-6 text-center text-slate-500 font-sans">
                  No flare events matching filter criteria.
                </td>
              </tr>
            ) : (
              flares.map((row) => {
                const cls = row.class || 'A0.0';
                const clsColor = cls.startsWith('X')
                  ? 'text-red-400 font-bold'
                  : cls.startsWith('M')
                  ? 'text-amber-400 font-bold'
                  : 'text-slate-300';

                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedFlare(row)}
                    className="hover:bg-slate-900/80 cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-bold text-cyan-400">{row.id}</td>
                    <td className="p-3">{row.onset ? row.onset.replace('T', ' ').replace('Z', '') : '-'}</td>
                    <td className="p-3">{row.peak ? row.peak.replace('T', ' ').replace('Z', '') : '-'}</td>
                    <td className={`p-3 ${clsColor}`}>{cls}</td>
                    <td className="p-3 text-right text-cyan-300">
                      {row.peak_flux_sxr ? row.peak_flux_sxr.toExponential(2) : '-'}
                    </td>
                    <td className="p-3 text-right text-purple-300">
                      {row.hardness ? row.hardness.toFixed(3) : '-'}
                    </td>
                    <td className="p-3 text-right text-orange-300">
                      {row.impulsivity ? row.impulsivity.toFixed(2) : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-400 font-bold">
                        {row.impact_index ? row.impact_index.toFixed(2) : '0.0'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 text-[10px] rounded bg-slate-900 text-slate-400 border border-slate-800">
                        {row.detection_method || 'BOCPD'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 text-right">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel-glow-amber p-6 rounded-2xl max-w-xl w-full relative">
            <button
              onClick={() => setSelectedFlare(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-100 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4">
              <span className="text-cyan-400">Flare Detail:</span>
              <span className="font-mono-val">{selectedFlare.id}</span>
              <span className="px-2.5 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/40">
                {selectedFlare.class}
              </span>
            </h3>

            <div className="grid grid-cols-2 gap-4 font-mono-val text-xs">
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-500">ONSET TIMESTAMP</div>
                <div className="text-slate-200 mt-1 font-bold">{selectedFlare.onset}</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-500">PEAK TIMESTAMP</div>
                <div className="text-slate-200 mt-1 font-bold">{selectedFlare.peak}</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-500">SXR PEAK FLUX</div>
                <div className="text-cyan-400 mt-1 font-bold">{selectedFlare.peak_flux_sxr?.toExponential(3)} W/m²</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-500">HXR PEAK FLUX</div>
                <div className="text-amber-400 mt-1 font-bold">{selectedFlare.peak_flux_hxr?.toExponential(3)} W/m²</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-500">IMPACT INDEX / R-LEVEL</div>
                <div className="text-red-400 mt-1 font-bold">{selectedFlare.impact_index?.toFixed(2)} ({selectedFlare.r_level})</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-500">DETECTION ENGINE</div>
                <div className="text-purple-400 mt-1 font-bold">{selectedFlare.detection_method}</div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedFlare(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
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
