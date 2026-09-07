// API response envelope
export interface Envelope<T> {
  data: T;
  meta: {
    timestamp: string;
    mode: string;
    event_date: string;
    cursor: string;
    error?: string;
  };
}

export interface DataPoint {
  t: string;
  v: number | null;
}

export interface ChangePoint {
  t: string;
  p: number;
}

export interface FlareInterval {
  start: string;
  end: string;
  class: string;
}

export interface StreamGap {
  start: string;
  end: string;
}

export interface StreamsLatest {
  solexs: DataPoint[];
  hel1os: DataPoint[];
  quality: number[];
  flare_intervals: FlareInterval[];
  changepoints: ChangePoint[];
  gaps: StreamGap[];
}

export interface ActiveFlare {
  id: string;
  onset: string;
  peak: string;
  end: string | null;
  state: 'quiet' | 'onset' | 'rising' | 'peak' | 'decay';
  class: string;
  peak_flux_sxr: number;
  peak_flux_hxr: number;
  hardness: number;
  impulsivity: number;
  integrated_flux: number;
  index: number;
  severity_band: string;
  r_level: string;
  detection_method: string;
  posterior: number;
}

export interface NowcastState {
  state: 'quiet' | 'onset' | 'rising' | 'peak' | 'decay';
  active: ActiveFlare | null;
  threshold_baseline_active: boolean;
}

export interface ForecastHorizon {
  horizon_min: number;
  p_c1: number;
  p_m1: number;
  q50: number;
  q90: number;
  q99: number;
}

export interface ForecastData {
  horizons: ForecastHorizon[];
}

export interface ImpactSubscores {
  peak_sxr: number;
  hardness: number;
  impulsivity: number;
  duration: number;
}

export interface ImpactCurrent {
  index: number;
  band: string;
  r_level: string;
  g_level: string;
  s_level: string;
  subscores: ImpactSubscores;
  flare_id?: string;
  note: string;
}

export interface CatalogueFlare {
  id: string;
  onset: string;
  peak: string;
  end: string | null;
  class: string;
  peak_flux_sxr: number;
  peak_flux_hxr: number;
  hardness: number;
  impulsivity: number;
  integrated_flux: number;
  impact_index: number;
  severity_band: string;
  r_level: string;
  detection_method: string;
  onset_idx: number;
  peak_idx: number;
  end_idx: number | null;
  posterior: number;
}

export interface CatalogueData {
  items: CatalogueFlare[];
  page: number;
  page_size: number;
  total: number;
}

export interface Alert {
  id: number;
  ts: string;
  type: string;
  severity: string;
  flare_id: string | null;
  message: string;
}

export interface Clock {
  utc: string;
  ist: string;
}

export interface HealthStatus {
  status: string;
  data_last_timestamp: string;
  engines: {
    nowcast: string;
    forecast: string;
    impact: string;
  };
  mode: string;
  playing: boolean;
  speed: number;
}

export interface ReplayDates {
  dates: string[];
}

/** Canonical replay state returned by every replay control mutation. */
export interface ReplayState {
  playing: boolean;
  speed: number;
  cursor_idx: number;
  cursor: string;
  event_date: string;
  mode: string;
}

/** Payload for POST /api/replay/control. */
export type ReplayAction = 'play' | 'pause' | 'toggle' | 'stop' | 'seek' | 'speed' | 'status';

export interface ReplayControlBody {
  action: ReplayAction;
  speed?: number;
  cursor?: number;
}

export interface ReplayStartResult {
  session_id: number | null;
  event_date: string;
  speed: number;
  cursor: string;
}

export interface FlareDetail extends CatalogueFlare {
  series?: {
    solexs: DataPoint[];
    hel1os: DataPoint[];
    posterior: DataPoint[];
  };
  subscores: ImpactSubscores;
  confidence?: string;
}
