import React from 'react';
import { AlertTriangle, RefreshCw, Store } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches any uncaught rendering error anywhere below it in the tree and
 * shows a calm, friendly recovery screen instead of a blank white page -
 * which is what a shop owner would otherwise see if any component threw
 * mid-sale. The technical details are logged to the console for
 * debugging, never shown to the person using the till.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log full technical detail for developers - never shown in the UI.
    console.error('Sellora POS crashed:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F1F5F9] dark:bg-slate-950 px-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-6 sm:p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-500 mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Something went wrong</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Sellora POS ran into an unexpected problem. Your sales and stock data are safe - this only affected the
            current screen.
          </p>

          <button
            onClick={this.handleReload}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Sellora POS
          </button>

          <button
            onClick={() => (window.location.href = '/')}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-medium py-2"
          >
            <Store className="w-3.5 h-3.5" />
            Return to the start
          </button>

          <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-4">
            If this keeps happening, contact support with a screenshot of this message.
          </p>
        </div>
      </div>
    );
  }
}
