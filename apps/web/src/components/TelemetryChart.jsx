import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Activity, Layers, Maximize2, RefreshCw } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function TelemetryChart({ streamData, windowSize, onWindowChange }) {
  const [showPosterior, setShowPosterior] = useState(true);

  const solexsData = streamData?.solexs || [];
  const hel1osData = streamData?.hel1os || [];
  const changepoints = streamData?.changepoints || [];
  const flareIntervals = streamData?.flare_intervals || [];

  const chartData = useMemo(() => {
    const labels = solexsData.map((d) => {
      const timeStr = d.t ? d.t.split('T')[1]?.replace('Z', '') : '';
      return timeStr.substring(0, 5);
    });

    const sxrValues = solexsData.map((d) => (d.v && d.v > 0 ? d.v : 1e-9));
    const hxrValues = hel1osData.map((d) => (d.v && d.v > 0 ? d.v : 1e-10));

    // Align changepoint probabilities onto x axis
    const cpMap = new Map();
    changepoints.forEach((cp) => cpMap.set(cp.t, cp.p));
    const cpValues = solexsData.map((d) => (cpMap.has(d.t) ? cpMap.get(d.t) : 0));

    return {
      labels,
      datasets: [
        {
          label: 'SoLEXS SXR (0.5–10 Å) [W/m²]',
          data: sxrValues,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.2,
          yAxisID: 'ySXR',
          fill: true,
        },
        {
          label: 'HEL1OS HXR (10–150 keV) [W/m²]',
          data: hxrValues,
          borderColor: '#f97316',
          backgroundColor: 'rgba(249, 115, 22, 0.05)',
          borderWidth: 1.8,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.2,
          yAxisID: 'yHXR',
        },
        ...(showPosterior
          ? [
              {
                label: 'BOCPD Change-Point P(CP)',
                data: cpValues,
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                borderWidth: 1.5,
                borderDash: [4, 4],
                pointRadius: 0,
                yAxisID: 'yCP',
              },
            ]
          : []),
      ],
    };
  }, [solexsData, hel1osData, changepoints, showPosterior]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#64748b', maxTicksLimit: 12, font: { family: 'JetBrains Mono', size: 10 } },
      },
      ySXR: {
        type: 'logarithmic',
        position: 'left',
        min: 1e-8,
        max: 1e-3,
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: {
          color: '#38bdf8',
          font: { family: 'JetBrains Mono', size: 10 },
          callback: (value) => {
            if (value === 1e-8) return 'A (1e-8)';
            if (value === 1e-7) return 'B (1e-7)';
            if (value === 1e-6) return 'C (1e-6)';
            if (value === 1e-5) return 'M (1e-5)';
            if (value === 1e-4) return 'X (1e-4)';
            if (value === 1e-3) return 'X10 (1e-3)';
            return '';
          },
        },
        title: { display: true, text: 'Soft X-Ray Flux (W/m²)', color: '#38bdf8', font: { size: 11 } },
      },
      yHXR: {
        type: 'logarithmic',
        position: 'right',
        min: 1e-10,
        max: 1e-4,
        grid: { drawOnChartArea: false },
        ticks: { color: '#fb923c', font: { family: 'JetBrains Mono', size: 10 } },
        title: { display: true, text: 'Hard X-Ray Flux (W/m²)', color: '#fb923c', font: { size: 11 } },
      },
      yCP: {
        type: 'linear',
        position: 'right',
        min: 0,
        max: 1,
        display: false,
      },
    },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#cbd5e1', font: { size: 11 }, usePointStyle: true, boxWidth: 8 },
      },
      tooltip: {
        backgroundColor: 'rgba(8, 13, 26, 0.95)',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += context.parsed.y < 0.01 ? context.parsed.y.toExponential(2) : context.parsed.y.toFixed(3);
            }
            return label;
          },
        },
      },
    },
  };

  return (
    <div className="glass-panel p-5 rounded-2xl flex flex-col h-[460px]">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-bold text-slate-100">Solar X-Ray Telemetry Stream (Aditya-L1)</h3>
          <span className="px-2 py-0.5 text-[10px] font-mono-val bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">
            {solexsData.length} pts
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Toggle Change-point overlay */}
          <button
            onClick={() => setShowPosterior(!showPosterior)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showPosterior
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>BOCPD P(CP)</span>
          </button>

          {/* Window size switcher */}
          <div className="flex items-center bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-xs font-mono-val">
            {[60, 120, 360, 1440].map((w) => (
              <button
                key={w}
                onClick={() => onWindowChange(w)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  windowSize === w ? 'bg-amber-500 text-black font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {w >= 60 ? `${w / 60}h` : `${w}m`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Canvas Container */}
      <div className="flex-1 w-full min-h-0 relative">
        <Line data={chartData} options={options} />
      </div>

      {/* Bottom GOES Threshold legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-800/60 text-[11px] text-slate-400 font-mono-val">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 font-sans font-medium">GOES Scale:</span>
          <span className="text-blue-400">A (&lt;1e-7)</span>
          <span className="text-green-400">B (1e-7)</span>
          <span className="text-yellow-400">C (1e-6)</span>
          <span className="text-amber-400 font-bold">M (1e-5)</span>
          <span className="text-red-400 font-bold">X (1e-4+)</span>
        </div>
        <div className="text-slate-500">
          Dual Payloads: SoLEXS (0.5–10 Å) & HEL1OS (10–150 keV)
        </div>
      </div>
    </div>
  );
}
