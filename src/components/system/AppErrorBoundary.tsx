import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

interface AppErrorBoundaryProps {
  children: ReactNode;
  resetKey: string;
  onReturnDashboard: () => void;
}

interface AppErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error("POS page crashed", error, errorInfo);
  }

  componentDidUpdate(previousProps: AppErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, errorInfo: null });
    }
  }

  copyDiagnosticInfo = async () => {
    const { error, errorInfo } = this.state;
    const payload = {
      message: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      createdAt: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  reloadApp = () => {
    window.location.reload();
  };

  returnDashboard = () => {
    this.setState({ error: null, errorInfo: null });
    this.props.onReturnDashboard();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Card className="mx-auto mt-10 max-w-3xl border-red-500/40 bg-[var(--pos-panel)] p-6">
        <div className="text-sm font-bold uppercase tracking-wide text-red-300">Page Error</div>
        <h1 className="mt-2 text-2xl font-black text-[var(--pos-text)]">This screen hit a problem.</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--pos-muted)]">
          The local POS is still running. Return to Dashboard, reload the app, or copy diagnostic info for troubleshooting.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={this.returnDashboard}>Return Dashboard</Button>
          <Button variant="secondary" onClick={this.reloadApp}>Reload App</Button>
          <Button variant="secondary" onClick={() => void this.copyDiagnosticInfo()}>Copy Diagnostic Info</Button>
        </div>
        {import.meta.env.DEV ? (
          <details className="mt-5 rounded-[var(--pos-radius-md)] border border-[var(--pos-border)] bg-[var(--pos-bg)] p-4 text-xs text-[var(--pos-muted)]">
            <summary className="cursor-pointer font-bold text-[var(--pos-text)]">Developer details</summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap">{this.state.error.stack}</pre>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</pre>
          </details>
        ) : null}
      </Card>
    );
  }
}
