import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppErrorBoundary from '../components/AppErrorBoundary';

function BrokenRoute(): never {
  throw new Error('route render failed');
}

describe('AppErrorBoundary', () => {
  it('renders a recovery screen when a route throws', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <BrokenRoute />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: 'This screen could not load' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Return home' })).toBeVisible();
    error.mockRestore();
  });
});
