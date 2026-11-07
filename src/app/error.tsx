"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-rose-300">Error</p>
      <h1 className="font-[family-name:var(--font-display)] text-2xl text-slate-100">
        This page hit a snag
      </h1>
      <p className="text-sm text-slate-400">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
      >
        Try again
      </button>
    </div>
  );
}
