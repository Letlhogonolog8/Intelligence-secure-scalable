import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class SurvivorDashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState((prev) => ({
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    // Log to monitoring service
    console.error("Survivor Dashboard Error:", error, errorInfo);

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Send to error tracking service (e.g., Sentry)
    if (import.meta.env.PROD) {
      // window.Sentry?.captureException(error, { contexts: { react: errorInfo } });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, errorCount } = this.state;
      const isRecurring = errorCount > 2;

      return (
        <div className="min-h-screen bg-[#04060c] text-slate-50 flex items-center justify-center p-6">
          <Card className="max-w-2xl w-full border-red-500/20 bg-slate-950/70 p-8">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  {isRecurring ? "Persistent Error Detected" : "Something Went Wrong"}
                </h1>
                <p className="text-slate-300 text-sm">
                  {isRecurring
                    ? "We're experiencing recurring issues. Please try reloading the page or contact support."
                    : "We encountered an unexpected error. Your data is safe, and you can try again."}
                </p>
              </div>

              {import.meta.env.DEV && error && (
                <div className="w-full text-left">
                  <details className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-300 mb-2">
                      Error Details (Development Only)
                    </summary>
                    <div className="space-y-2 text-xs font-mono">
                      <div>
                        <span className="text-red-400">Error:</span>
                        <pre className="text-slate-400 mt-1 whitespace-pre-wrap">
                          {error.toString()}
                        </pre>
                      </div>
                      {errorInfo && (
                        <div>
                          <span className="text-red-400">Stack Trace:</span>
                          <pre className="text-slate-400 mt-1 whitespace-pre-wrap max-h-40 overflow-auto">
                            {errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                      <div>
                        <span className="text-amber-400">Error Count:</span>
                        <span className="text-slate-400 ml-2">{errorCount}</span>
                      </div>
                    </div>
                  </details>
                </div>
              )}

              <div className="flex flex-wrap gap-3 justify-center">
                {!isRecurring && (
                  <Button
                    onClick={this.handleReset}
                    className="bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}
                <Button
                  onClick={this.handleReload}
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              </div>

              <div className="pt-4 border-t border-white/10 w-full">
                <p className="text-xs text-slate-500">
                  If this problem persists, please contact support with error code:{" "}
                  <span className="font-mono text-slate-400">
                    ERR-{Date.now().toString(36).toUpperCase()}
                  </span>
                </p>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
