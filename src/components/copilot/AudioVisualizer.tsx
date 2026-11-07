"use client";

import { useEffect, useRef } from "react";

type AudioVisualizerProps = {
  level: number;
  active: boolean;
};

/** Canvas bars driven by mic level from useAudioCapture. */
export function AudioVisualizer({ level, active }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(level);
  const activeRef = useRef(active);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let raf = 0;

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const bars = 28;
      const gap = 3;
      const barWidth = (width - gap * (bars - 1)) / bars;
      const base = activeRef.current ? levelRef.current : 0.05;

      for (let i = 0; i < bars; i += 1) {
        const wave =
          0.35 +
          Math.sin(frame / 12 + i * 0.45) * 0.25 +
          Math.cos(frame / 18 + i * 0.2) * 0.15;
        const h = Math.max(4, height * base * wave);
        const x = i * (barWidth + gap);
        const y = (height - h) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + h);
        gradient.addColorStop(0, "rgba(62, 207, 190, 0.95)");
        gradient.addColorStop(1, "rgba(62, 207, 190, 0.2)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, h, 3);
        ctx.fill();
      }

      frame += 1;
      raf = requestAnimationFrame(draw);
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="h-16 w-full overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
