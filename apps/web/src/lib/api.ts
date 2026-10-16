import type { Envelope } from '../types/api';

export class ApiError extends Error {
  status: number;
  retryAfter: number | null;
  constructor(status: number, message: string, retryAfter: number | null = null) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
    this.name = 'ApiError';
  }
}

/** Thrown when the backend returns 503 with the "starting" state. */
export class BackendStartingError extends ApiError {
  state: string;
  constructor(retryAfter: number, state: string = 'starting') {
    super(503, `Backend is ${state}`, retryAfter);
    this.name = 'BackendStartingError';
    this.state = state;
  }
}

const FETCH_TIMEOUT_MS = 30_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  if (init?.signal?.aborted) controller.abort();
  init?.signal?.addEventListener('abort', abortFromCaller, { once: true });
  try {
    const res = await fetch(`${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
      signal: controller.signal,
    });
    if (res.status === 503) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10) || 5;
      // Only boot-time 503s get the long readiness retry policy. A genuine
      // upstream/live-source outage remains visible to the caller instead of
      // being misrepresented as a starting backend.
      try {
        const json = await res.json();
        if (json?.data?.state === 'starting' || json?.meta?.error === 'starting') {
          throw new BackendStartingError(retryAfter, json?.data?.state ?? 'starting');
        }
        throw new ApiError(503, json?.meta?.detail ?? 'Service temporarily unavailable', retryAfter);
      } catch (e) {
        if (e instanceof ApiError) throw e;
        throw new ApiError(503, 'Service temporarily unavailable', retryAfter);
      }
    }
    if (!res.ok) {
      throw new ApiError(res.status, `API ${res.status}: ${res.statusText}`);
    }
    const json: Envelope<T> = await res.json();
    if (json.meta?.error && json.meta.error !== 'starting') {
      throw new ApiError(500, json.meta.error);
    }
    return json.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out or was cancelled');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    init?.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, { ...init, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
};
