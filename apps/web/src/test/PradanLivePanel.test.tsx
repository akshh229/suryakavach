import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PradanLivePanel from '../components/PradanLivePanel';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

const mockFetch = vi.fn();
global.fetch = mockFetch;

const statusPayload = {
  data: {
    watching: false,
    inbox: 'data/pradan_inbox',
    interval: 5,
    seen_count: 10,
    last_new: [],
    last_poll: null,
    old_count: 10,
    old_bytes: 14400000,
    old_mb: 13.7,
    new_count: 0,
    new_files: [],
    new_bytes: 0,
    new_mb: 0,
    total_count: 10,
    total_bytes: 14400000,
    total_mb: 13.7,
    missing_count: 0,
    pending: [],
    pending_count: 0,
    polls: 2,
    total_new_all_time: 10,
    schedule: {
      scheduled: false,
      inbox: 'data/pradan_inbox',
      interval_min: 30,
      last_error: null,
      last_pass: undefined,
      last_new: [],
    },
  },
  meta: { timestamp: '', mode: '', event_date: '', cursor: '' },
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => statusPayload,
  });
});

describe('PradanLivePanel', () => {
  it('renders the panel heading', () => {
    renderWithProviders(<PradanLivePanel />);
    expect(screen.getByText('PRADAN Live Ingest')).toBeInTheDocument();
  });

  it('shows old/new analytics from the status payload', async () => {
    renderWithProviders(<PradanLivePanel />);
    expect(await screen.findByText('OLD 10 · NEW 0 · 13.7 MB')).toBeInTheDocument();
  });

  it('renders action buttons', async () => {
    renderWithProviders(<PradanLivePanel />);
    await screen.findByText('OLD 10 · NEW 0 · 13.7 MB');
    expect(screen.getByRole('button', { name: 'Check now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check PRADAN listing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download unseen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auto-watch off' })).toBeInTheDocument();
  });

  it('shows the raw-intake honesty note', async () => {
    renderWithProviders(<PradanLivePanel />);
    expect(await screen.findByText(/Raw L1 intake only/i)).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<PradanLivePanel />);
    expect(screen.getByText(/Loading ingest state/i)).toBeInTheDocument();
  });
});
