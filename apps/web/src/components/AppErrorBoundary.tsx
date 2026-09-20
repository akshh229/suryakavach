import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error | null;
}

/** Keeps a route render failure actionable instead of leaving a blank shell. */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log exception for debugging across devices and browsers
    console.error('[SURYAKAVACH ErrorBoundary]', error, errorInfo);
  }

  private retry = () => {
    this.setState({ hasError: false, error: null });
  };

  private goHome = () => {
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-space px-6 py-24 text-ink" aria-labelledby="app-error-title">
          <div className="mx-auto max-w-lg rounded-lg border border-rule bg-space-raised p-8">
            <p className="text-xs uppercase tracking-[0.22em] text-accent-soft">SURYAKAVACH</p>
            <h1 id="app-error-title" className="mt-3 font-display text-3xl">This screen could not load</h1>
            <p className="mt-3 text-ink-muted text-sm">
              The application encountered an issue rendering this section. Retry this screen or return to the landing page.
            </p>
            {this.state.error?.message && (
              <div className="mt-3 p-3 text-xs font-mono-val border border-alarm/30 bg-alarm/5 text-alarm overflow-x-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={this.retry}
                className="sk-touch rounded-full bg-accent px-5 py-2 text-sm text-white"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={this.goHome}
                className="sk-touch rounded-full border border-rule px-5 py-2 text-sm text-ink"
              >
                Return home
              </button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
