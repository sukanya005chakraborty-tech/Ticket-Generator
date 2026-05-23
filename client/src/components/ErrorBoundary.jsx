import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-secondary-900 p-4">
          <div className="max-w-md w-full text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-red-100 dark:bg-red-950 rounded-full">
                <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              An unexpected error occurred. Please try refreshing the page or contact support if
              the problem persists.
            </p>
            {this.state.error && (
              <details className="mb-6 text-left bg-gray-100 dark:bg-secondary-800 rounded-lg p-4">
                <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                  Error details
                </summary>
                <pre className="mt-2 text-xs text-red-600 dark:text-red-400 overflow-auto whitespace-pre-wrap">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = '/dashboard')}
                className="px-4 py-2 border border-gray-300 dark:border-secondary-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-secondary-800 transition-colors font-medium"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
