"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { TranscriptEntry } from "@/lib/types";
import { GlassPanel } from "@/components/ui/GlassPanel";

type LiveTranscriptFeedProps = {
  entries: TranscriptEntry[];
  interim?: string;
  footer?: ReactNode;
};

export function LiveTranscriptFeed({
  entries,
  interim,
  footer,
}: LiveTranscriptFeedProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [entries, interim]);

  return (
    <GlassPanel className="flex min-h-[32rem] flex-col overflow-hidden ring-1 ring-white/5">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-5 py-3.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Live transcript
        </h2>
        <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">
          {entries.length} lines
        </span>
      </div>
      <div
        ref={scrollerRef}
        className="flex-1 space-y-3 overflow-y-auto px-5 py-4"
      >
        {entries.length === 0 && !interim ? (
          <p className="text-sm italic text-[var(--muted)]">
            Listening for interviewer questions…
          </p>
        ) : null}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="animate-rise rounded-xl border border-white/5 bg-black/25 p-3"
          >
            <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              <span className="text-[var(--accent)]">{entry.role}</span>
              <span className="font-[family-name:var(--font-mono)]">
                {new Date(entry.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-[var(--ink)]">
              {entry.text}
            </p>
          </div>
        ))}
        {interim ? (
          <p className="text-sm italic text-[var(--muted)] opacity-80">
            {interim}
          </p>
        ) : null}
      </div>
      {footer}
    </GlassPanel>
  );
}
