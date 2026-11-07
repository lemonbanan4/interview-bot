"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GuidanceChat } from "@/components/GuidanceChat";
import {
  AI_PERSONA_OPTIONS,
  type InterviewProfile,
} from "@/lib/types";
import { emptyProfile } from "@/lib/types";
import { loadProfile, saveProfile } from "@/lib/storage";

const glass =
  "bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-2xl transition-all duration-300";

const STEPS = [
  "Resume",
  "Job description",
  "AI persona",
  "Screen-share safety",
] as const;

export default function SetupWizardPage() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<InterviewProfile>(emptyProfile());
  const [ready, setReady] = useState(false);
  const [safetyChecked, setSafetyChecked] = useState(false);

  useEffect(() => {
    const loaded = loadProfile();
    setProfile(loaded);
    setSafetyChecked(Boolean(loaded.screenShareSafetyAck));
    setReady(true);
  }, []);

  function update<K extends keyof InterviewProfile>(
    key: K,
    value: InterviewProfile[K],
  ) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function onResumeFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setProfile((prev) => ({
      ...prev,
      resumeText: text,
      resumeFileName: file.name,
    }));
  }

  function finishWizard() {
    const next = {
      ...profile,
      screenShareSafetyAck: true,
      updatedAt: Date.now(),
    };
    saveProfile(next);
    setProfile(next);
    setStep(4);
  }

  const canNext =
    step === 0
      ? profile.resumeText.trim().length > 40
      : step === 1
        ? profile.jobDescription.trim().length > 40 &&
          profile.jobTitle.trim().length > 1
        : step === 2
          ? Boolean(profile.aiPersona)
          : safetyChecked;

  if (!ready) {
    return <div className={`skeleton mx-auto h-80 max-w-3xl ${glass}`} />;
  }

  if (step >= 4) {
    return (
      <div className="mx-auto max-w-lg space-y-5 pt-8 text-center">
        <div className={`${glass} space-y-3 p-8`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Setup complete
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-slate-100">
            You&apos;re ready for Signal
          </h1>
          <p className="text-sm text-slate-400">
            Resume, role, {profile.aiPersona || "concise"} persona, and
            screen-share safety are saved. Practice with the mentor or open the
            live HUD.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href="/session"
              className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
            >
              Open live HUD
            </Link>
            <Link
              href="/dashboard/chat"
              className="rounded-xl border border-slate-800 px-4 py-2.5 text-sm text-slate-200 transition hover:border-emerald-500/40"
            >
              AI mentor
            </Link>
            <Link
              href="/prepare"
              className="rounded-xl border border-slate-800 px-4 py-2.5 text-sm text-slate-200 transition hover:border-emerald-500/40"
            >
              Prepare desk
            </Link>
          </div>
        </div>
        <GuidanceChat profile={profile} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
          Onboarding
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold text-slate-100">
          Pre-flight setup
        </h1>
        <p className="text-sm text-slate-400">
          Resume, target role, coaching persona, and the critical screen-share
          safety rule before you go live.
        </p>
      </header>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`${glass} px-3 py-3 text-center text-xs font-medium ${
              index === step
                ? "border-emerald-500/40 text-emerald-300"
                : index < step
                  ? "text-slate-300"
                  : "text-slate-500"
            }`}
          >
            <span className="block text-[10px] uppercase tracking-[0.16em] opacity-70">
              Step {index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <section className={`${glass} space-y-4 p-6`}>
        {step === 0 ? (
          <>
            <h2 className="text-lg text-slate-100">Upload resume</h2>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 px-4 py-10 text-center transition hover:border-emerald-500/50">
              <span className="text-sm text-slate-200">
                Drop .txt / .md or click to browse
              </span>
              <span className="text-xs text-slate-500">
                {profile.resumeFileName || "PDF: paste extracted text below"}
              </span>
              <input
                type="file"
                accept=".txt,.md,.text,text/plain"
                className="hidden"
                onChange={(e) => onResumeFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <textarea
              value={profile.resumeText}
              onChange={(e) => update("resumeText", e.target.value)}
              rows={12}
              placeholder="Paste resume text…"
              className="w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-500/50"
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h2 className="text-lg text-slate-100">Target job description</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="text-slate-400">Job title</span>
                <input
                  value={profile.jobTitle}
                  onChange={(e) => update("jobTitle", e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-emerald-500/50"
                  placeholder="Staff Frontend Engineer"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-slate-400">Company</span>
                <input
                  value={profile.company}
                  onChange={(e) => update("company", e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-emerald-500/50"
                  placeholder="Acme"
                />
              </label>
            </div>
            <textarea
              value={profile.jobDescription}
              onChange={(e) => update("jobDescription", e.target.value)}
              rows={12}
              placeholder="Paste the job description…"
              className="w-full resize-y rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-500/50"
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h2 className="text-lg text-slate-100">Configure AI persona</h2>
            <p className="text-sm text-slate-400">
              Guides how the live HUD and mentor shape your talking points.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {AI_PERSONA_OPTIONS.map((option) => {
                const selected = profile.aiPersona === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => update("aiPersona", option.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-emerald-400/50 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-950/40 hover:border-slate-600"
                    }`}
                  >
                    <p className="font-medium text-slate-100">{option.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {option.blurb}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="text-lg text-slate-100">Screen-share safety</h2>
            <div className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm leading-relaxed text-slate-300">
              <p className="font-semibold text-amber-300">
                Never share your Entire Screen while the Stealth HUD or Tauri
                overlay is running.
              </p>
              <p>
                Always choose <strong className="text-white">Window</strong> or{" "}
                <strong className="text-white">Tab</strong> in Zoom, Meet, or
                Teams. The HUD is a separate OS window — full-screen capture
                will record it.
              </p>
            </div>
            <label className="flex cursor-pointer select-none items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <input
                type="checkbox"
                checked={safetyChecked}
                onChange={(e) => setSafetyChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-400"
              />
              <span className="text-sm text-slate-300">
                I will share only a specific Window or Tab — never my Entire
                Screen — during live interviews with Signal.
              </span>
            </label>
          </>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-600 disabled:opacity-30"
          >
            Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => {
                saveProfile({ ...profile, updatedAt: Date.now() });
                setStep((s) => s + 1);
              }}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={!canNext}
              onClick={finishWizard}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-40"
            >
              Finish setup
            </button>
          )}
        </div>
      </section>

      <GuidanceChat profile={profile} />
    </div>
  );
}
