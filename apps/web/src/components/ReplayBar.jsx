import React from 'react';
import { Play, Pause, RotateCcw, FastForward, Calendar, Sliders } from 'lucide-react';

export default function ReplayBar({
  playing,
  speed,
  cursorIdx,
  eventDate,
  availableDates,
  onPlayToggle,
  onSpeedChange,
  onCursorChange,
  onDateChange,
}) {
  const formatMinutes = (m) => {
    const hrs = Math.floor(m / 60);
    const mins = m % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-panel p-4 rounded-2xl sticky bottom-4 z-40 shadow-2xl border-t border-slate-700/80">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Date Selector & Play Controls */}
        <div className="flex items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono-val">
            <Calendar className="w-4 h-4 text-amber-400" />
            <select
              value={eventDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer font-bold"
            >
              {availableDates.map((d) => (
                <option key={d} value={d} className="bg-slate-900 text-slate-200">
                  {d} {d === '2024-02-22' ? '(X6.3 Flare)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Play / Pause Toggle */}
          <button
            onClick={onPlayToggle}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              playing
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                : 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30'
            }`}
          >
            {playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          {/* Speed Buttons */}
          <div className="flex items-center bg-slate-900/80 p-0.5 rounded-xl border border-slate-800 text-xs font-mono-val">
            {[1, 5, 20, 60].map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  speed === s ? 'bg-amber-500 text-black font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Scrubber Timeline */}
        <div className="flex-1 w-full flex items-center gap-3">
          <span className="text-xs font-mono-val text-slate-400 min-w-12 text-right">
            {formatMinutes(cursorIdx)}
          </span>

          <input
            type="range"
            min="0"
            max="1439"
            value={cursorIdx}
            onChange={(e) => onCursorChange(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />

          <span className="text-xs font-mono-val text-slate-400 min-w-12">
            23:59
          </span>
        </div>

        {/* Live Replay Indicator */}
        <div className="hidden lg:flex items-center gap-2 font-mono-val text-xs text-slate-400">
          <span className={`w-2.5 h-2.5 rounded-full ${playing ? 'bg-amber-400 animate-ping' : 'bg-slate-600'}`} />
          <span>REPLAY: {eventDate} @ {speed}× SPEED</span>
        </div>
      </div>
    </div>
  );
}
