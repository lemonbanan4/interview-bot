"use client";

import type { TalkingPoint } from "@/lib/types";
import { GlassPanel } from "@/components/ui/GlassPanel";

type ActionCardGridProps = {
  points: TalkingPoint[];
  streamingBullets?: string[];
  streamingTitle?: string;
  loading?: boolean;
};

export function ActionCardGrid({
  points,
  streamingBullets = [],
  streamingTitle,
  loading,
}: ActionCardGridProps) {
  const latest = points[0];
  const earlier = points.slice(1, 4);

  return (
    <div className="flex min-h-[32rem] flex-col gap-4">
      <GlassPanel
        glow
        className="relative flex-1 overflow-hidden p-5 ring-1 ring-[var(--accent)]/20"
      >
        <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[var(--accent)]/10 blur-3xl" />
        <div className="relative mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            AI talking points
          </h2>
          {loading ? (
            <span className="text-xs text-[var(--accent)]">Streaming…</span>
          ) : null}
        </div>

        <div className="relative">
          {loading && streamingBullets.length === 0 && !latest ? (
            <div className="space-y-3">
              <div className="skeleton h-6 w-1/2 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-5/6 rounded" />
              <div className="skeleton h-4 w-4/6 rounded" />
            </div>
          ) : null}

          {loading && streamingBullets.length > 0 ? (
            <div className="animate-rise space-y-4">
              <h3 className="font-[family-name:var(--font-display)] text-xl font-medium text-[var(--accent)]">
                {streamingTitle || "Drafting…"}
              </h3>
              <ul className="space-y-3">
                {streamingBullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-3 py-2.5 text-sm text-[var(--ink)]"
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!loading && latest ? (
            <div key={latest.id} className="animate-rise space-y-4">
              <h3 className="font-[family-name:var(--font-display)] text-xl font-medium text-[var(--accent)]">
                {latest.title}
              </h3>
              <ul className="space-y-3">
                {latest.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent-soft)] px-3 py-2.5 text-sm leading-relaxed text-[var(--ink)]"
                  >
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!loading && !latest ? (
            <p className="text-sm italic text-[var(--muted)]">
              Strategic points will generate instantly here…
            </p>
          ) : null}
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
