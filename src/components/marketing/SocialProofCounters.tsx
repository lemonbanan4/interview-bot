"use client";

import { useEffect, useState } from "react";

const STATS = [
  { label: "Interviews coached", target: 12840, suffix: "+" },
  { label: "Avg. score lift", target: 18, suffix: " pts" },
  { label: "Teams on Signal", target: 420, suffix: "+" },
] as const;

function useCountUp(target: number, active: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target]);
  return value;
}

function Stat({
  label,
  target,
  suffix,
  active,
}: {
  label: string;
  target: number;
  suffix: string;
  active: boolean;
}) {
  const value = useCountUp(target, active);
  return (
    <div className="text-center">
      <p className="font-[family-name:var(--font-display)] text-3xl font-semibold text-slate-50 md:text-4xl">
        {value.toLocaleString()}
        {suffix}
      </p>
      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

export function SocialProofCounters() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setActive(true), 200);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="grid gap-8 sm:grid-cols-3">
      {STATS.map((stat) => (
        <Stat key={stat.label} {...stat} active={active} />
      ))}
    </div>
  );
}
