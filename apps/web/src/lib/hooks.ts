import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from './api';
import type {
  StreamsLatest,
  NowcastState,
  ForecastData,
  ImpactCurrent,
  HealthStatus,
  CatalogueData,
  FlareDetail,
  ReplayDates,
  Alert,
  Clock,
} from '../types/api';

export function useStreams(windowSize: number) {
  return useQuery({
    queryKey: ['streams', windowSize],
    queryFn: () => api.get<StreamsLatest>(`/api/streams/latest?window=${windowSize}`),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

export function useNowcast() {
  return useQuery({
    queryKey: ['nowcast'],
    queryFn: () => api.get<NowcastState>('/api/nowcast/state'),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

export function useForecast() {
  return useQuery({
    queryKey: ['forecast'],
    queryFn: () => api.get<ForecastData>('/api/forecast/horizons'),
    staleTime: 30_000,
  });
}

export function useImpact() {
  return useQuery({
    queryKey: ['impact'],
    queryFn: () => api.get<ImpactCurrent>('/api/impact/current'),
    staleTime: 10_000,
    refetchInterval: 10_000,
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
  return useQuery({
    queryKey: ['catalogue', minClass],
    queryFn: () => api.get<CatalogueData>(`/api/flare/catalogue?min_class=${minClass}&page_size=50`),
    staleTime: 60_000,
  });
}

export function useFlareDetail(id: string | null) {
  return useQuery({
    queryKey: ['flare', id],
    queryFn: () => api.get<FlareDetail>(`/api/flare/${id}`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useReplayDates() {
  return useQuery({
    queryKey: ['replayDates'],
    queryFn: () => api.get<ReplayDates>('/api/replay/dates'),
    staleTime: Infinity,
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get<Alert[]>('/api/alerts'),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

export function useClock(): Clock | null {
  // Clock comes through WS, not REST — this is a fallback
  return null;
}

export function useReplayControl() {
  return useMutation({
    mutationFn: (params: { action: string; speed?: number; cursor?: number }) =>
      api.post('/api/replay/control', params),
  });
}

export function useSetEventDate() {
  return useMutation({
    mutationFn: (date: string) => api.post('/api/replay/start', { event_date: date, speed: 20 }),
  });
}
