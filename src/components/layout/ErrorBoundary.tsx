import { Component, type ErrorInfo, type ReactNode } from "react";

// Top-level safety net: catches render errors anywhere in the provider/tree so a single
// throwing component degrades to a recoverable screen instead of a blank page. (Event
// handler errors are not caught by boundaries — that class is handled at the source, e.g.
// parseWholeInput for the loops inputs.) TanStack Router's per-route errorComponent still
// handles route-level errors first; this wraps everything, providers included.
type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <h1 className="text-xl text-err">render error</h1>
          <p className="max-w-md text-sm text-text-dim">
            A component threw an error. This is a bug in the portal, not a chain issue. Try
            reloading the page. If it persists, clearing the session tx log (localStorage key{" "}
            <code className="text-info">aff-tx-log</code>) and reloading may help.
          </p>
          <pre className="max-w-md overflow-x-auto border border-border bg-panel-2 px-3 py-2 text-left text-xs text-err">
            {this.state.error.message.slice(0, 300)}
          </pre>
          <button
            type="button"
            className="border border-border bg-panel-2 px-3 py-1 text-xs text-text hover:border-accent-dim"
            onClick={() => window.location.reload()}
          >
            ▸ reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
