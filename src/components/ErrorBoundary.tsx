// src/components/ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: Readonly<ErrorBoundaryProps>;
  declare setState: Component<ErrorBoundaryProps, ErrorBoundaryState>['setState'];

  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-white rounded-xl border border-rose-200 shadow-sm text-center my-6 max-w-2xl mx-auto">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            {this.props.fallbackTitle || 'Component Error Encountered'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            {this.state.error?.message || 'An unexpected rendering error occurred while loading this section.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reload Page</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
