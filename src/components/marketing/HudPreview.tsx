"use client";

import { useEffect, useState } from "react";

const HINTS = [
  "Lead with the migration outcome — 40% latency drop.",
  "Name the tradeoff: consistency vs. p99 under load.",
  "Close with why this role’s scale fits your last two years.",
];

/**
 * Decorative live HUD simulation for the marketing hero (no network).
 */
export function HudPreview() {
  const [hintIndex, setHintIndex] = useState(0);
  const [opacity, setOpacity] = useState(0.82);

  useEffect(() => {
    const id = window.setInterval(() => {
      setHintIndex((i) => (i + 1) % HINTS.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 rounded-[2rem] bg-emerald-400/10 blur-3xl" aria-hidden />
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl"
        style={{ opacity }}
      >
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Stealth · coaching
          </span>
          <label className="ml-auto flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">
            Opacity
            <input
              type="range"
              min={0.4}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-16 accent-emerald-400"
              aria-label="Preview opacity"
            />
          </label>
        </div>
        <p
          key={hintIndex}
          className="mt-3 min-h-[3.5rem] text-sm leading-snug text-slate-50 transition-opacity duration-500"
        >
          {HINTS[hintIndex]}
        </p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] text-slate-300">
            Listen
          </span>
          <span className="rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] text-slate-400">
            Click-through · ⌥
          </span>
        </div>
      </div>
    </div>
  );
}
