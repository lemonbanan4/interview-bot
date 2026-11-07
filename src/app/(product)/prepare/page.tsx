"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GuidanceChat } from "@/components/GuidanceChat";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import type { InterviewProfile } from "@/lib/types";
import { emptyProfile } from "@/lib/types";
import { loadProfile, saveProfile } from "@/lib/storage";

export default function PreparePage() {
  const [profile, setProfile] = useState<InterviewProfile>(emptyProfile());
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setReady(true);
  }, []);

  function update<K extends keyof InterviewProfile>(
    key: K,
    value: InterviewProfile[K],
  ) {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function onResumeFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setProfile((prev) => ({
      ...prev,
      resumeText: text,
      resumeFileName: file.name,
    }));
    setSaved(false);
  }

  async function onJdFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setProfile((prev) => ({
      ...prev,
      jobDescription: text,
    }));
    setSaved(false);
  }

  function handleSave() {
    saveProfile(profile);
    setSaved(true);
  }

  const canStart =
    profile.resumeText.trim().length > 40 &&
    profile.jobDescription.trim().length > 40;

  if (!ready) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <div className="space-y-8">
      <section className="animate-rise space-y-3">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
          Prepare
        </p>
        <h1 className="max-w-2xl font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--ink)] md:text-5xl">
          Load your story. Walk in ready.
        </h1>
        <p className="max-w-xl text-[var(--muted)]">
          Upload a resume and target job description. The live HUD streams STT
          + LLM talking points; the dashboard stores review scores after.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <GlassPanel className="animate-rise space-y-4 p-5 [animation-delay:60ms]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
              Resume
            </h2>
            {profile.resumeFileName ? (
              <span className="truncate font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
                {profile.resumeFileName}
              </span>
            ) : null}
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-8 text-center transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
            <span className="text-sm text-[var(--ink)]">
              Drop a .txt / .md resume or click to browse
            </span>
            <span className="text-xs text-[var(--muted)]">
              PDF: paste extracted text below for best results
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
            placeholder="Paste resume text…"
            rows={14}
            className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
        </GlassPanel>

        <GlassPanel className="animate-rise space-y-4 p-5 [animation-delay:120ms]">
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
            Target role
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="text-[var(--muted)]">Job title</span>
              <input
                value={profile.jobTitle}
                onChange={(e) => update("jobTitle", e.target.value)}
                placeholder="Staff Frontend Engineer"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-[var(--muted)]">Company</span>
              <input
                value={profile.company}
                onChange={(e) => update("company", e.target.value)}
                placeholder="Acme"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
            </label>
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-6 text-center transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
            <span className="text-sm text-[var(--ink)]">
              Upload job description file
            </span>
            <input
              type="file"
              accept=".txt,.md,.text,text/plain"
              className="hidden"
              onChange={(e) => onJdFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <textarea
            value={profile.jobDescription}
            onChange={(e) => update("jobDescription", e.target.value)}
            placeholder="Paste the job description…"
            rows={10}
            className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
          />
        </GlassPanel>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="ghost" onClick={handleSave}>
          {saved ? "Saved" : "Save profile"}
        </Button>
        {canStart ? (
          <Link
            href="/session"
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#041512] transition hover:brightness-110"
          >
            Open live HUD
          </Link>
        ) : (
          <span className="rounded-xl bg-white/5 px-5 py-2.5 text-sm text-[var(--muted)]">
            Open live HUD
          </span>
        )}
        {!canStart ? (
          <span className="text-sm text-[var(--muted)]">
            Add enough resume and job text to unlock the session.
          </span>
        ) : null}
        <Link
          href="/setup"
          className="text-sm text-[var(--accent)] hover:underline"
        >
          Or run the setup wizard →
        </Link>
      </section>

      <GuidanceChat profile={profile} />
    </div>
  );
}
