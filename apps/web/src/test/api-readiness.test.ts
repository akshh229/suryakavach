import { describe, expect, it, vi } from 'vitest';
import { api, ApiError, BackendStartingError } from '../lib/api';

describe('API readiness errors', () => {
  it('uses the bounded startup retry path only for an explicit starting response', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Retry-After': '3' }),
      json: async () => ({ data: { ready: false, state: 'starting' }, meta: {} }),
    } as Response);

    await expect(api.get('/api/ready')).rejects.toBeInstanceOf(BackendStartingError);
    fetchMock.mockRestore();
  });

  it('does not disguise a live-source outage as backend startup', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Retry-After': '30' }),
      json: async () => ({ data: null, meta: { error: 'live_unavailable' } }),
    } as Response);

    await expect(api.get('/api/live/goes')).rejects.toBeInstanceOf(ApiError);
    try {
      await api.get('/api/live/goes');
    } catch (error) {
      expect(error).not.toBeInstanceOf(BackendStartingError);
    }
    fetchMock.mockRestore();
  });
});
