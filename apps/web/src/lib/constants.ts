// GOES flare classification thresholds (W/m²) for 1-8 Å soft X-ray band
// A < 1e-7, B = 1e-7→1e-6, C = 1e-6→1e-5, M = 1e-5→1e-4, X ≥ 1e-4
export const GOES_CLASSES = [
  { label: 'A', threshold: 0, color: '#16a34a', bg: '#f0fdf4' },
  { label: 'B', threshold: 1e-7, color: '#0284c7', bg: '#f0f9ff' },
  { label: 'C', threshold: 1e-6, color: '#d97706', bg: '#fffbeb' },
  { label: 'M', threshold: 1e-5, color: '#ea580c', bg: '#fff7ed' },
  { label: 'X', threshold: 1e-4, color: '#dc2626', bg: '#fef2f2' },
] as const;

export function goesClass(flux: number): string {
  for (let i = GOES_CLASSES.length - 1; i >= 0; i--) {
    if (flux >= GOES_CLASSES[i].threshold) return GOES_CLASSES[i].label;
  }
  return 'A';
}

export function goesClassColor(flux: number): string {
  for (let i = GOES_CLASSES.length - 1; i >= 0; i--) {
    if (flux >= GOES_CLASSES[i].threshold) return GOES_CLASSES[i].color;
  }
  return GOES_CLASSES[0].color;
}

// NOAA R-scale severity mapping from impact index
export const R_SCALE = [
  { level: 'R0', min: 0, max: 2, color: '#16a34a', label: 'Minor' },
  { level: 'R1', min: 2, max: 4, color: '#0284c7', label: 'Minor' },
  { level: 'R2', min: 4, max: 6, color: '#d97706', label: 'Moderate' },
  { level: 'R3', min: 6, max: 8, color: '#ea580c', label: 'Strong' },
  { level: 'R4', min: 8, max: 9, color: '#dc2626', label: 'Severe' },
  { level: 'R5', min: 9, max: 10, color: '#991b1b', label: 'Extreme' },
] as const;

export function rLevel(index: number): string {
  for (let i = R_SCALE.length - 1; i >= 0; i--) {
    if (index >= R_SCALE[i].min) return R_SCALE[i].level;
  }
  return 'R0';
}

export function rLevelColor(index: number): string {
  for (let i = R_SCALE.length - 1; i >= 0; i--) {
    if (index >= R_SCALE[i].min) return R_SCALE[i].color;
  }
  return R_SCALE[0].color;
}

// Impact index subscore weights (must sum to 1.0)
export const IMPACT_WEIGHTS = {
  peak_sxr: 0.35,
  hardness: 0.25,
  impulsivity: 0.20,
  duration: 0.20,
} as const;

// Forecast horizon defaults (minutes)
export const FORECAST_HORIZONS = [5, 10, 20, 40] as const;

// Risk probability thresholds
export const RISK_THRESHOLDS = {
  low: 0.2,
  moderate: 0.5,
  high: 0.8,
} as const;

export function riskLevel(p: number): 'low' | 'moderate' | 'high' | 'extreme' {
  if (p >= RISK_THRESHOLDS.high) return 'extreme';
  if (p >= RISK_THRESHOLDS.moderate) return 'high';
  if (p >= RISK_THRESHOLDS.low) return 'moderate';
  return 'low';
}

export function riskColor(p: number): string {
  if (p >= RISK_THRESHOLDS.high) return '#dc2626';
  if (p >= RISK_THRESHOLDS.moderate) return '#ea580c';
  if (p >= RISK_THRESHOLDS.low) return '#d97706';
  return '#16a34a';
}

// Instrument series colours — single source for every Plotly trace and
// legend. Darkened from the Tailwind palette so they hold up on warm white.
export const SERIES_COLORS = {
  sxr: '#0e7490',       // SoLEXS soft X-ray
  hxr: '#c2410c',       // HEL1OS hard X-ray
  posterior: '#6d28d9', // BOCPD P(CP)
} as const;

// Chart chrome neutrals, matched to the token palette in index.css.
export const CHART_COLORS = {
  grid: '#ecebe7',
  zeroline: '#d8d6d1',
  plotBg: '#faf9f7',
  gapBand: '#e7e5e0',
} as const;

/**
 * Offline validation metrics.
 *
 * Transcribed by hand from backend/reports/metrics.md — synthetic fused
 * SoLEXS/HEL1OS cache, NOT an operational claim. Both cohorts are shown on
 * the dashboard: the all-class row is where the 56 false positives live, and
 * hiding it behind the M+ row would misrepresent the evaluation.
 *
 * There is no /api/metrics endpoint yet; when one exists, delete this
 * constant and query it instead — the panel reads it through one import.
 */
export const METRICS = {
  allClass: { label: 'All classes', tss: 0.001, hss: 0.001, far: 0.659, tp: 29, fp: 56, fn: 1 },
  mPlus: { label: 'M+ only', tss: 1.0, hss: 1.0, far: 0.0 },
  meanOnsetLeadMin: 16.5,
  targetTss: 0.6,
  targetLeadMin: 3,
  provenance: 'backend/reports/metrics.md — synthetic fused SoLEXS/HEL1OS cache',
} as const;

// Nowcast state labels and colors
export const NOWCAST_STATES = {
  quiet: { label: 'Quiet', color: '#16a34a', bg: '#f0fdf4' },
  onset: { label: 'Onset', color: '#d97706', bg: '#fffbeb' },
  rising: { label: 'Rising', color: '#ea580c', bg: '#fff7ed' },
  peak: { label: 'Peak', color: '#dc2626', bg: '#fef2f2' },
  decay: { label: 'Decay', color: '#0284c7', bg: '#f0f9ff' },
} as const;

export type NowcastStateKey = keyof typeof NOWCAST_STATES;

// Replay constants
export const REPLAY = {
  MIN_CURSOR: 0,
  MAX_CURSOR: 1439,
  DEFAULT_SPEED: 20,
  // Must stay within the API's accepted range (1..60, see api.py ReplayControl)
  // and match config.yaml `replay.speeds`.
  SPEEDS: [1, 5, 20, 60] as const,
  DEFAULT_EVENT_DATE: '2024-02-22',
  TICK_MS: 500,
} as const;

// API base. Same-origin by default: the Vite dev proxy handles it locally and
// the vercel.json /api rewrite handles it in production, so REST stays CORS-free.
export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

// Vercel rewrites do NOT proxy WebSocket upgrades, so in production this must
// point straight at the API host. VITE_WS_URL is set in .env.production; the
// same-origin fallback is for local dev, where the Vite proxy forwards /ws.
export const WS_URL =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/live`;
