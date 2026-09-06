import { Play, Pause, Calendar } from 'lucide-react';
import { REPLAY } from '../lib/constants';
import { useReplayStore } from '../store/replayStore';

export default function ReplayBar() {
  const { playing, speed, cursor, eventDate, dates, togglePlay, setSpeed, setCursor, setEventDate } =
    useReplayStore();

  const formatMinutes = (m: number) => {
    const hrs = Math.floor(m / 60);
    const mins = m % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  return (
    <div className="sk-panel p-4 sticky bottom-4 z-40" role="toolbar" aria-label="Replay controls">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono-val">
            <Calendar className="w-4 h-4 text-amber-500" />
            <label className="sr-only" htmlFor="replay-date">Event date</label>
            <select
              id="replay-date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="bg-transparent text-slate-700 outline-none cursor-pointer font-bold"
            >
              {dates.length > 0 ? (
                dates.map((d) => (
                  <option key={d} value={d}>
                    {d} {d === REPLAY.DEFAULT_EVENT_DATE ? '(X6.3 Flare)' : ''}
                  </option>
                ))
              ) : (
                <option value={REPLAY.DEFAULT_EVENT_DATE}>
                  {REPLAY.DEFAULT_EVENT_DATE} (X6.3 Flare)
                </option>
              )}
            </select>
          </div>

          {/* Play / Pause Toggle */}
          <button
            onClick={togglePlay}
            aria-label={playing ? 'Pause replay' : 'Play replay'}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              playing
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                : 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30'
            }`}
          >
            {playing ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          {/* Speed Buttons */}
          <div className="flex items-center bg-slate-50 p-0.5 rounded-xl border border-slate-200 text-xs font-mono-val">
            {REPLAY.SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                aria-pressed={speed === s}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  speed === s ? 'bg-amber-500 text-black font-bold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>

        {/* Scrubber Timeline */}
        <div className="flex-1 w-full flex items-center gap-3">
          <span className="text-xs font-mono-val text-slate-500 min-w-12 text-right">
            {formatMinutes(cursor)}
          </span>

          <label className="sr-only" htmlFor="replay-scrubber">Replay timeline</label>
          <input
            id="replay-scrubber"
            type="range"
            min={REPLAY.MIN_CURSOR}
            max={REPLAY.MAX_CURSOR}
            value={cursor}
            onChange={(e) => setCursor(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />

          <span className="text-xs font-mono-val text-slate-500 min-w-12">23:59</span>
        </div>

        {/* Live Replay Indicator */}
        <div className="hidden lg:flex items-center gap-2 font-mono-val text-xs text-slate-500">
          <span className={`w-2.5 h-2.5 rounded-full ${playing ? 'bg-amber-400 animate-ping' : 'bg-slate-400'}`} />
          <span>REPLAY: {eventDate} @ {speed}× SPEED</span>
        </div>
      </div>
    </div>
  );
}
