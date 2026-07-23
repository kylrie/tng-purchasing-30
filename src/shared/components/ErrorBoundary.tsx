import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isStaleDeployError, reloadForStaleDeployOnce } from '../utils/staleDeploy';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Diagnostics stay in the console only — never rendered to the user.
    console.error("Uncaught error:", error, errorInfo);
    // A stale-bundle failure after a deploy self-heals with one guarded reload.
    if (isStaleDeployError(error)) reloadForStaleDeployOnce();
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      // Customer/staff-facing: never expose raw error text, stacks, Vite internals,
      // or env/config details. Clean message + reload; details are DEV-only.
      const stale = isStaleDeployError(this.state.error);
      return (
        <div className="p-6 bg-slate-800 border border-slate-700 rounded-2xl text-white text-center max-w-md mx-auto my-8">
          <div className="text-4xl mb-3" aria-hidden="true">{stale ? '🔄' : '⚠️'}</div>
          <h2 className="text-lg font-bold mb-2">
            {stale ? 'The app was updated' : 'Something went wrong'}
          </h2>
          <p className="text-slate-300 mb-5 text-sm">
            {stale
              ? 'A new version is available. Please reload to continue.'
              : 'The app ran into a problem. Please reload to continue.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold transition-colors"
          >
            Reload
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-5 whitespace-pre-wrap text-left text-xs font-mono text-red-300">
              {this.state.error.stack ?? this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
