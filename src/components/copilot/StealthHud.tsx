"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { isTauriDesktop, setClickThrough } from "@/lib/tauriDesktop";

export type StealthHUDProps = {
  opacity?: number;
  onOpacityChange?: (value: number) => void;
  liveStatus?: string;
  listening?: boolean;
  suggestion?: string;
  onToggleListen?: () => void;
  onExitStealth?: () => void;
  onEndSession?: () => void;
  ending?: boolean;
  canEnd?: boolean;
  /** Compact desktop-overlay mode (Tauri /hud). */
  companion?: boolean;
};

/**
 * Frameless stealth HUD for screen shares.
 *
 * In Tauri: rests click-through (mouse passes to Zoom/Meet). Hold ⌥/Alt to
 * grab the overlay, then hover to keep it interactive; leave to rest again.
 */
export function StealthHUD({
  opacity = 0.78,
  onOpacityChange,
  liveStatus = "standby",
  listening = false,
  suggestion = "",
  onToggleListen,
  onExitStealth,
  onEndSession,
  ending = false,
  canEnd = false,
  companion = false,
}: StealthHUDProps) {
  // Always start as "not desktop" so SSR + first client paint match.
  const [desktop, setDesktop] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [interactive, setInteractive] = useState(true);
  const [altHeld, setAltHeld] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    setDesktop(isTauriDesktop());
  }, []);

  const syncClickThrough = useEffectEvent(
    async (nextInteractive: boolean) => {
      setInteractive(nextInteractive);
      if (!isTauriDesktop()) return;
      await setClickThrough(!nextInteractive);
    },
  );

  useEffect(() => {
    if (!desktop) return;
    void syncClickThrough(false);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Alt") return;
      setAltHeld(true);
      void syncClickThrough(true);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Alt") return;
      setAltHeld(false);
      if (!hovering) void syncClickThrough(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [desktop, hovering]);

  const onEnter = () => {
    setHovering(true);
    if (desktop && (altHeld || interactive)) {
      void syncClickThrough(true);
    }
  };

  const onLeave = () => {
    setHovering(false);
    if (desktop && !altHeld) {
      void syncClickThrough(false);
    }
  };

  return (
    <div
      className={
        companion
          ? "flex h-screen w-screen items-start justify-end bg-transparent p-3"
          : "fixed inset-x-0 bottom-6 z-[60] flex justify-center bg-transparent px-4 pointer-events-none"
      }
    >
      <div
        ref={panelRef}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        className={`pointer-events-auto w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-300 ${
          interactive ? "ring-1 ring-teal-400/30" : "ring-0"
        }`}
        style={{ opacity }}
      >
        <div
          className="flex flex-wrap items-center gap-2"
          {...(companion ? { "data-tauri-drag-region": true } : {})}
        >
          <span
            className={`inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] ${
              listening ? "text-teal-300" : "text-slate-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                listening ? "bg-teal-400 animate-pulse" : "bg-slate-600"
              }`}
            />
            {companion ? "Overlay" : "Stealth"} · {liveStatus}
          </span>

          {desktop ? (
            <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
              {interactive ? "Interactive" : "Click-through · hold ⌥"}
            </span>
          ) : null}

          {onOpacityChange ? (
            <label className="ml-auto flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Opacity
              <input
                type="range"
                min={0.15}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(e) => onOpacityChange(Number(e.target.value))}
                className="w-24 accent-teal-400"
                onMouseDown={(e) => e.stopPropagation()}
              />
            </label>
          ) : (
            <span className="ml-auto" />
          )}
        </div>

        <p className="mt-2 max-h-20 overflow-hidden text-sm leading-snug text-slate-50/95 line-clamp-3 select-none">
          {suggestion || "Waiting for talking points…"}
        </p>

        {(onToggleListen || onExitStealth || onEndSession) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {onToggleListen ? (
              <button
                type="button"
                onClick={onToggleListen}
                className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-teal-500/40"
              >
                {listening ? "Pause" : "Listen"}
              </button>
            ) : null}
            {onExitStealth ? (
              <button
                type="button"
                onClick={onExitStealth}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500"
              >
                Exit stealth
              </button>
            ) : null}
            {onEndSession ? (
              <button
                type="button"
                onClick={onEndSession}
                disabled={ending || !canEnd}
                className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-40"
              >
                {ending ? "Saving…" : "End"}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/** Alias for existing imports. */
export const StealthHud = StealthHUD;
