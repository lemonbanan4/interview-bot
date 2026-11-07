"use client";

import type { TalkingPoint } from "@/lib/types";
import { GlassPanel } from "@/components/ui/GlassPanel";

type StreamingSuggestionsProps = {
  completion: string;
  isLoading: boolean;
  savedPoints: TalkingPoint[];
};

/** Token-streaming AI panel powered by Vercel AI SDK useCompletion. */
export function StreamingSuggestions({
  completion,
  isLoading,
  savedPoints,
}: StreamingSuggestionsProps) {
  const earlier = savedPoints.slice(completion ? 0 : 1, completion ? 3 : 4);

  return (
    <div className="flex min-h-[32rem] flex-col gap-4">
      <GlassPanel
        glow
        className="relative flex flex-1 flex-col overflow-hidden p-5 ring-1 ring-[var(--accent)]/20"
      >
        <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[var(--accent)]/10 blur-3xl" />
        <div className="relative mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Instant AI strategy
          </h2>
          {isLoading ? (
            <span className="animate-pulse text-xs font-medium text-[var(--accent)]">
              Generating…
            </span>
          ) : null}
        </div>

        <div className="relative flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/35 p-4">
          {completion ? (
            <pre className="animate-rise whitespace-pre-wrap font-[family-name:var(--font-mono)] text-sm leading-relaxed text-[var(--ink)]">
              {completion}
              {isLoading ? (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-[var(--accent)] align-middle" />
              ) : null}
            </pre>
          ) : (
            <p className="text-sm italic text-[var(--muted)]">
              Strategic talking points stream here the moment the interviewer
              speaks…
            </p>
          )}
        </div>
      </GlassPanel>

      {earlier.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {earlier.map((point) => (
            <GlassPanel key={point.id} className="p-4">
              <p className="text-sm font-medium text-[var(--ink)]">{point.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                {point.bullets[0]}
              </p>
            </GlassPanel>
          ))}
        </div>
      ) : null}
    </div>
  );
}
