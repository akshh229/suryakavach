import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, BackendStartingError } from './api';
import { useReplayStore } from '../store/replayStore';
import type {
  StreamsLatest,
  NowcastState,
  ForecastData,
  ImpactCurrent,
  ImpactScale,
  HealthStatus,
  CatalogueData,
  FlareDetail,
  ReplayDates,
  ReplayState,
  ReplayControlBody,
  ReplayStartResult,
  Alert,
  EvaluationRunDto,
  PradanStatus,
  PradanPollResult,
  PradanPollBody,
  PradanDiscoverResult,
  PradanScheduleState,
  GoesLivePayload,
  GoesLiveStatus,
} from '../types/api';

/**
 * Retry configuration for engine-dependent hooks.
 * Retries up to 20 times on 503 (backend starting) with bounded backoff + jitter,
 * and respects Retry-After headers. Other errors retry 2 times normally.
 */
function engineRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof BackendStartingError) {
    return failureCount < 20; // ~60s max with 3s Retry-After
  }
  return failureCount < 2;
}

function engineRetryDelay(attempt: number, error: unknown): number {
  if (error instanceof BackendStartingError && error.retryAfter) {
    // Respect Retry-After + small jitter to avoid thundering herd
    return error.retryAfter * 1000 + Math.random() * 500;
  }
  return Math.min(1000 * 2 ** attempt, 10_000) + Math.random() * 500;
}

/** Readiness check: polls /api/ready until the backend is usable. */
export function useBackendReady() {
  return useQuery({
    queryKey: ['backendReady'],
    queryFn: ({ signal }) => api.get<{ ready: boolean; state: string }>('/api/ready', { signal }),
    retry: (failureCount, error) => {
      if (error instanceof BackendStartingError) return failureCount < 20;
      return failureCount < 3;
    },
    retryDelay: (attempt, error) => {
      if (error instanceof BackendStartingError) {
        return (error.retryAfter ?? 3) * 1000 + Math.random() * 500;
      }
      return Math.min(1000 * 2 ** attempt, 10_000);
    },
    staleTime: 30_000,
    refetchInterval: (query) => {
      // Stop polling once ready; poll every 3s while starting
      return query.state.data?.ready ? false : 3_000;
    },
  });
}

/** Gate engine calls behind the shared readiness query. React Query deduplicates
 * this key, so mounting many dashboard panels still produces one readiness
 * poll rather than a request storm. */
function useEngineEnabled(enabled: boolean = true): boolean {
  const readiness = useBackendReady();
  return enabled && readiness.data?.ready === true;
}

export function useStreams(windowSize: number) {
  const enabled = useEngineEnabled();
  return useQuery({
    queryKey: ['streams', windowSize],
    queryFn: ({ signal }) => api.get<StreamsLatest>(`/api/streams/latest?window=${windowSize}`, { signal }),
    enabled,
    staleTime: 10_000,
    refetchInterval: 10_000,
    retry: engineRetry,
    retryDelay: engineRetryDelay,
  });
}

export function useNowcast() {
  const enabled = useEngineEnabled();
  return useQuery({
    queryKey: ['nowcast'],
    queryFn: ({ signal }) => api.get<NowcastState>('/api/nowcast/state', { signal }),
    enabled,
    staleTime: 10_000,
    refetchInterval: 10_000,
    retry: engineRetry,
    retryDelay: engineRetryDelay,
  });
}

export function useForecast() {
  const enabled = useEngineEnabled();
  return useQuery({
    queryKey: ['forecast'],
    queryFn: ({ signal }) => api.get<ForecastData>('/api/forecast/horizons', { signal }),
    enabled,
    staleTime: 30_000,
    retry: engineRetry,
    retryDelay: engineRetryDelay,
  });
}

export function useImpact() {
  const enabled = useEngineEnabled();
  return useQuery({
    queryKey: ['impact'],
    queryFn: ({ signal }) => api.get<ImpactCurrent>('/api/impact/current', { signal }),
    enabled,
    staleTime: 10_000,
    refetchInterval: 10_000,
    retry: engineRetry,
    retryDelay: engineRetryDelay,
  });
}

export function useImpactScale() {
  const enabled = useEngineEnabled();
  return useQuery({
    queryKey: ['impactScale'],
    queryFn: ({ signal }) => api.get<ImpactScale>('/api/impact/scale', { signal }),
    enabled,
    staleTime: Infinity,
    retry: engineRetry,
    retryDelay: engineRetryDelay,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<HealthStatus>('/api/health'),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useCatalogue(minClass: string = 'A') {
  const enabled = useEngineEnabled();
  return useQuery({
    queryKey: ['catalogue', minClass],
    queryFn: ({ signal }) => api.get<CatalogueData>(`/api/flare/catalogue?min_class=${minClass}&page_size=50`, { signal }),
    enabled,
    staleTime: 60_000,
    retry: engineRetry,
    retryDelay: engineRetryDelay,
  });
}

export function useFlareDetail(id: string | null) {
  const enabled = useEngineEnabled(!!id);
  return useQuery({
    queryKey: ['flare', id],
    queryFn: ({ signal }) => api.get<FlareDetail>(`/api/flare/${id}`, { signal }),
    enabled,
    staleTime: 60_000,
    retry: engineRetry,
    retryDelay: engineRetryDelay,
  });
}

export function useReplayDates() {
  const enabled = useEngineEnabled();
  return useQuery({
    queryKey: ['replayDates'],
    queryFn: ({ signal }) => api.get<ReplayDates>('/api/replay/dates', { signal }),
    enabled,
    staleTime: Infinity,
  });
}

export function useAlerts() {
  const enabled = useEngineEnabled();
  return useQuery({
    queryKey: ['alerts'],
    queryFn: ({ signal }) => api.get<Alert[]>('/api/alerts', { signal }),
    enabled,
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

export function useMetrics(runId?: string) {
  const enabled = useEngineEnabled();
  return useQuery({
    queryKey: ['metrics', runId],
    queryFn: ({ signal }) => api.get<EvaluationRunDto>(runId ? `/api/metrics/${runId}` : '/api/metrics', { signal }),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Server-state queries that depend on the replay cursor. Any replay mutation
 * invalidates these so the view reflects the new cursor without waiting for
 * the next WebSocket tick.
 */
const CURSOR_DEPENDENT_KEYS = ['streams', 'nowcast', 'forecast', 'impact', 'alerts', 'health'];

function useReplaySync() {
  const queryClient = useQueryClient();

  return (state: ReplayState) => {
    // Read actions imperatively: this helper only writes, so it must not
    // subscribe the calling component to store updates.
    const { setPlaying, setSpeed, setCursor, setEventDate, setMode } = useReplayStore.getState();
    // The API response is authoritative — adopt it rather than trusting the
    // optimistic local value.
    setPlaying(state.playing);
    setSpeed(state.speed);
    setCursor(state.cursor_idx);
    setEventDate(state.event_date);
    if (state.mode === 'live' || state.mode === 'replay') setMode(state.mode);
    for (const key of CURSOR_DEPENDENT_KEYS) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
}

/** Unified replay control: play, pause, toggle, stop, seek, speed, status. */
export function useReplayControl() {
  const sync = useReplaySync();
  return useMutation({
    mutationFn: (body: ReplayControlBody) => api.post<ReplayState>('/api/replay/control', body),
    onSuccess: sync,
  });
}

/** Switch the replayed event date. Restarts the session server-side. */
export function useStartReplay() {
  const sync = useReplaySync();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { event_date: string; speed: number }) =>
      api.post<ReplayStartResult>('/api/replay/start', params),
    onSuccess: async (result) => {
      // /start returns session info, not full replay state, so read back the
      // canonical state to stay in sync.
      const state = await api.post<ReplayState>('/api/replay/control', { action: 'status' });
      sync(state);
      queryClient.invalidateQueries({ queryKey: ['catalogue'] });
      return result;
    },
  });
}

/**
 * PRADAN live-intake hooks (additive; nothing here deletes or replaces
 * server state — every response is an old-vs-new diff to append from).
 *
 * Staging inbox products into the calibrated pipeline (registry/normalized)
 * stays an explicitly calibrated step owned by the ingestion modules; these
 * hooks only poll, discover, and fetch raw products.
 */

/** Read-only analytics, safe on a 5 s refetch (no network to PRADAN). */
export function usePradanStatus(enabled: boolean = true) {
  return useQuery({
    queryKey: ['pradanStatus'],
    queryFn: () => api.get<PradanStatus>('/api/pradan/status'),
    enabled,
    staleTime: 5_000,
    refetchInterval: enabled ? 5_000 : false,
  });
}

/**
 * One diff pass. `{}` = local diff only (5 s safe); `{ fetch_defaults: true }`
 * downloads only unseen files from the built-in list. On success the status
 * cache is refreshed so badges/counts update immediately.
 */
export function usePradanPoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PradanPollBody = {}) =>
      api.post<PradanPollResult>('/api/pradan/poll', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pradanStatus'] });
    },
  });
}

/** Live browse-table listing diffed vs the manifest (one network call). */
export function usePradanDiscover() {
  return useMutation({
    mutationFn: () => api.post<PradanDiscoverResult>('/api/pradan/discover'),
  });
}

/**
 * Slow auto-watch loop (discover → download → diff, default 30 min).
 * Failures degrade to a local diff server-side and surface as `last_error`.
 */
export function usePradanSchedule() {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pradanStatus'] });
  };
  return {
    runOnce: useMutation({
      mutationFn: () => api.post<Record<string, unknown>>('/api/pradan/schedule/run'),
      onSuccess: refresh,
    }),
    start: useMutation({
      mutationFn: (interval_min: number = 30) =>
        api.post<PradanScheduleState>('/api/pradan/schedule/start', { interval_min }),
      onSuccess: refresh,
    }),
    stop: useMutation({
      mutationFn: () => api.post<PradanScheduleState>('/api/pradan/schedule/stop'),
      onSuccess: refresh,
    }),
  };
}

/**
 * GOES XRS live source (additive; replay hooks above are untouched).
 * Server does stale-while-revalidate (refreshes when older than 5 min),
 * so a 60 s refetch here stays cheap and never hammers NOAA.
 */

/** Availability probe — never triggers a fetch. */
export function useGoesLiveStatus(enabled: boolean = true) {
  const engineEnabled = useEngineEnabled(enabled);
  return useQuery({
    queryKey: ['goesLiveStatus'],
    queryFn: ({ signal }) => api.get<GoesLiveStatus>('/api/live/goes/status', { signal }),
    enabled: engineEnabled,
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
  });
}

/** Live series + nowcast + forecast + impact in one payload. */
export function useGoesLive(windowSize: number, enabled: boolean = true) {
  const engineEnabled = useEngineEnabled(enabled);
  return useQuery({
    queryKey: ['goesLive', windowSize],
    queryFn: ({ signal }) => api.get<GoesLivePayload>(`/api/live/goes?window=${windowSize}`, { signal }),
    enabled: engineEnabled,
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
  });
}

/** Force a fresh NOAA fetch + nowcast (blocking, may take seconds). */
export function useGoesRefresh() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<GoesLiveStatus>('/api/live/goes/refresh'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goesLive'] });
      queryClient.invalidateQueries({ queryKey: ['goesLiveStatus'] });
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}
