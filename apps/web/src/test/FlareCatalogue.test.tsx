import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FlareCatalogue from '../components/FlareCatalogue';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

// Mock fetch for catalogue tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.resetAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      data: { items: [], page: 1, page_size: 50, total: 0 },
      meta: { timestamp: '', mode: '', event_date: '', cursor: '' },
    }),
  });
});

describe('FlareCatalogue', () => {
  it('renders the panel heading', async () => {
    renderWithProviders(<FlareCatalogue />);
    expect(screen.getByText('Flare Catalogue')).toBeInTheDocument();
  });

  it('renders filter links', () => {
    renderWithProviders(<FlareCatalogue />);
    expect(screen.getByRole('link', { name: 'ALL' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'X-CLASS' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'M-CLASS' })).toBeInTheDocument();
  });

  it('renders export CSV button', () => {
    renderWithProviders(<FlareCatalogue />);
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('shows empty state when no flares', async () => {
    renderWithProviders(<FlareCatalogue />);
    expect(await screen.findByText(/No flare events matching/i)).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders(<FlareCatalogue />);
    expect(screen.getByText(/Loading catalogue items/i)).toBeInTheDocument();
  });
});
