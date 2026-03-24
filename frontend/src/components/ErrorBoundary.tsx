import React from 'react';
import { createLogger, formatErrorForLogging } from '../utils/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

const errorBoundaryLogger = createLogger('ErrorBoundary');

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    errorBoundaryLogger.error('React render error captured', {
      error: formatErrorForLogging(error),
      componentStack: errorInfo.componentStack,
    });
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-lg w-full rounded-xl border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-gray-900">Something went wrong</h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              A render error was captured by the frontend logger. Open the browser console and inspect
              window.__SCOUT_LOGGER__.getLogs() for the full trace.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}