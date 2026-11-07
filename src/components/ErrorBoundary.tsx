"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = {
  error: Error | null;
};

/**
 * Catch render failures so a single panel crash does not blank the app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-rose-200">
            {this.props.fallbackTitle || "Something went wrong"}
          </h2>
          <p className="mt-2 text-sm text-rose-200/80">
            {this.state.error.message || "Unexpected UI error"}
          </p>
          <button
            type="button"
            className="mt-4 rounded-xl border border-rose-400/40 px-4 py-2 text-sm text-rose-100 transition hover:bg-rose-500/20"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
