import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/errors";
import { Button } from "@/components/ui/Button";

/** Last line of defence: a render crash shows a recoverable screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { reportError(error, info.componentStack ?? "render"); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">Something broke on our side</h1>
        <p className="max-w-sm text-sm text-muted">The error has been logged. Reloading usually fixes it.</p>
        <Button onClick={() => window.location.reload()}>Reload FlowPilot</Button>
      </div>
    );
  }
}
