"use client";

import { useEffect, useState } from "react";

type ScreenShareWarningModalProps = {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Gate before going live — reminds users never to share the entire screen
 * while the Tauri Stealth HUD is floating as a separate OS window.
 */
export default function ScreenShareWarningModal({
  isOpen,
  onConfirm,
  onCancel,
}: ScreenShareWarningModalProps) {
  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    if (!isOpen) setIsChecked(false);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="screen-share-warning-title"
    >
      <div className="flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-teal-500/25 bg-slate-900 p-6 text-slate-100 shadow-2xl shadow-teal-950/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2
              id="screen-share-warning-title"
              className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-white"
            >
              Screen-share safety rule
            </h2>
            <p className="text-xs text-slate-400">
              Read this carefully before joining your live call.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-300">
          <p className="font-semibold text-amber-400">
            Never select &quot;Entire Screen&quot; when sharing on Zoom, Meet, or
            Teams.
          </p>
          <p>
            Your Tauri Stealth HUD floats as an independent OS window. Sharing
            your{" "}
            <strong className="text-white">Entire Screen</strong> captures
            everything — including the HUD.
          </p>
          <p className="rounded-lg border border-teal-500/20 bg-teal-950/30 p-2.5 text-xs text-teal-200">
            <strong className="text-teal-100">The correct way:</strong> always
            choose <strong className="text-white">&quot;Window&quot;</strong> or{" "}
            <strong className="text-white">&quot;Tab&quot;</strong> (e.g. only VS
            Code or the meeting tab). The HUD stays outside that share.
          </p>
        </div>

        <label className="flex cursor-pointer select-none items-center gap-3">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
            className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-teal-400"
          />
          <span className="text-xs font-medium text-slate-300">
            I understand — I will share only a specific Window or Tab, never my
            Entire Screen.
          </span>
        </label>

        <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-slate-800/60 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!isChecked}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
              isChecked
                ? "cursor-pointer bg-teal-500 text-slate-950 shadow-lg shadow-teal-950/40 hover:bg-teal-400"
                : "cursor-not-allowed bg-slate-800 text-slate-500 opacity-60"
            }`}
          >
            Launch live HUD session
          </button>
        </div>
      </div>
    </div>
  );
}
