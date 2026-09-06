import { create } from 'zustand';
import { REPLAY } from '../lib/constants';

interface ReplayState {
  mode: 'live' | 'replay';
  playing: boolean;
  speed: number;
  cursor: number;
  eventDate: string;
  dates: string[];

  setMode: (mode: 'live' | 'replay') => void;
  setPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  setCursor: (cursor: number) => void;
  setEventDate: (date: string) => void;
  setDates: (dates: string[]) => void;
  stepCursor: (delta: number) => void;
}

export const useReplayStore = create<ReplayState>((set) => ({
  mode: 'live',
  playing: false,
  speed: REPLAY.DEFAULT_SPEED,
  cursor: REPLAY.MIN_CURSOR,
  eventDate: REPLAY.DEFAULT_EVENT_DATE,
  dates: [],

  setMode: (mode) => set({ mode }),
  setPlaying: (playing) => set({ playing }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setSpeed: (speed) => set({ speed }),
  setCursor: (cursor) =>
    set({ cursor: Math.max(REPLAY.MIN_CURSOR, Math.min(REPLAY.MAX_CURSOR, cursor)) }),
  setEventDate: (eventDate) => set({ eventDate }),
  setDates: (dates) => set({ dates }),
  stepCursor: (delta) =>
    set((s) => ({
      cursor: Math.max(REPLAY.MIN_CURSOR, Math.min(REPLAY.MAX_CURSOR, s.cursor + delta)),
    })),
}));
