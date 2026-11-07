"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioVisualizer } from "@/components/copilot/AudioVisualizer";
import { LiveTranscriptFeed } from "@/components/copilot/LiveTranscriptFeed";
import { StealthHUD } from "@/components/copilot/StealthHud";
import { publishLiveHint } from "@/lib/liveHint";
import { StreamingSuggestions } from "@/components/copilot/StreamingSuggestions";
import ScreenShareWarningModal from "@/components/ScreenShareWarningModal";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useInterviewCopilot } from "@/hooks/useInterviewCopilot";
import { useSttWindow } from "@/hooks/useSttWindow";
import { saveSessionToServer } from "@/lib/saveSession";
import {
  createSessionId,
  loadProfile,
  upsertSession,
} from "@/lib/storage";
import type {
  InterviewProfile,
  InterviewSession,
  TranscriptEntry,
} from "@/lib/types";
import { emptyProfile } from "@/lib/types";

export default function SessionPage() {
  const [profile, setProfile] = useState<InterviewProfile>(emptyProfile());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [ending, setEnding] = useState(false);
  const [endedId, setEndedId] = useState<string | null>(null);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(false);
  const [ready, setReady] = useState(false);
  const [manual, setManual] = useState("");
  const [stealth, setStealth] = useState(false);
  const [stealthOpacity, setStealthOpacity] = useState(0.72);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);

  const transcriptRef = useRef<TranscriptEntry[]>([]);

  useEffect(() => {
    setProfile(loadProfile());
    setSessionId(createSessionId());
    setReady(true);
  }, []);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    document.documentElement.dataset.stealth = stealth ? "on" : "off";
    return () => {
      delete document.documentElement.dataset.stealth;
    };
  }, [stealth]);

  const {
    aiSuggestions,
    savedPoints,
    isLoading,
    error: copilotError,
    processInterviewerInput,
  } = useInterviewCopilot(profile);

  const appendTranscript = useCallback((text: string) => {
    const entry: TranscriptEntry = {
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: "interviewer",
      text,
      timestamp: Date.now(),
    };
    setTranscript((prev) => {
      const next = [...prev, entry];
      transcriptRef.current = next;
      return next;
    });
  }, []);

  const onSttTranscript = useCallback(
    (text: string) => {
      appendTranscript(text);
      void processInterviewerInput(text);
    },
    [appendTranscript, processInterviewerInput],
  );

  const stt = useSttWindow(onSttTranscript);

  const audio = useAudioCapture({
    includeSystemAudio,
    windowMs: 1800,
    onPcmWindow: stt.sendPcmWindow,
  });

  const liveStatus = audio.isRecording
    ? stt.status === "stt"
      ? "transcribing"
      : isLoading
        ? "coaching"
        : "listening"
    : "standby";

  const stealthSuggestion =
    aiSuggestions.trim() ||
    savedPoints[0]?.bullets.slice(0, 2).join(" · ") ||
    "";

  useEffect(() => {
    publishLiveHint({
      suggestion: stealthSuggestion,
      liveStatus,
      listening: audio.isRecording,
    });
  }, [stealthSuggestion, liveStatus, audio.isRecording]);

  const canStart = useMemo(
    () =>
      profile.resumeText.trim().length > 40 &&
      profile.jobDescription.trim().length > 40,
    [profile],
  );

  function toggleLive() {
    if (audio.isRecording) {
      audio.stopCapture();
      return;
    }
    setIsSafetyModalOpen(true);
  }

  async function handleConfirmSession() {
    setIsSafetyModalOpen(false);
    await audio.startCapture();
  }

  async function submitManual(text: string) {
    appendTranscript(text);
    await processInterviewerInput(text);
  }

  async function endSession() {
    if (!sessionId) return;
    audio.stopCapture();
    setStealth(false);
    setEnding(true);
    const now = Date.now();
    const currentTranscript = transcriptRef.current;
    const createdAt = currentTranscript[0]?.timestamp || now;

    let session: InterviewSession = {
      id: sessionId,
      createdAt,
      endedAt: now,
      jobTitle: profile.jobTitle || "Untitled role",
      company: profile.company || "Unknown company",
      transcript: currentTranscript,
      talkingPoints: savedPoints,
      status: "completed",
    };

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: profile.resumeText,
          jobTitle: profile.jobTitle,
          company: profile.company,
          jobDescription: profile.jobDescription,
          transcript: currentTranscript,
        }),
      });
      const review = await response.json();
      if (!response.ok) throw new Error(review.error || "Review failed");

      session = {
        ...session,
        review: {
          summary: review.summary,
          score: review.score,
          strengths: review.strengths,
          improvements: review.improvements,
          highlights: review.highlights,
          metrics: review.metrics,
        },
      };
    } catch {
      /* keep session without review */
    }

    upsertSession(session);
    const saved = await saveSessionToServer(session);
    if (!saved.ok) {
      console.warn("Prisma session save failed:", saved.error);
    }

    setEndedId(session.id);
    setEnding(false);
  }

  if (!ready) return <div className="skeleton h-80 rounded-2xl" />;

  if (!canStart) {
    return (
      <GlassPanel className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Profile incomplete
        </h1>
        <p className="text-[var(--muted)]">
          Finish the setup wizard or prepare desk before going live.
        </p>
        <div className="flex justify-center gap-3">
          <Link href="/setup" className="text-[var(--accent)]">
            Open setup
          </Link>
          <Link href="/prepare" className="text-[var(--muted)]">
            Prepare
          </Link>
        </div>
      </GlassPanel>
    );
  }

  if (endedId) {
    return (
      <GlassPanel className="mx-auto max-w-lg animate-rise space-y-4 p-8 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Session saved
        </h1>
        <p className="text-[var(--muted)]">
          Transcript and review are ready on the dashboard.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href={`/dashboard/${endedId}`}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#041512]"
          >
            View review
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-[var(--ink)]"
          >
            All sessions
          </Link>
        </div>
      </GlassPanel>
    );
  }

  const safetyModal = (
    <ScreenShareWarningModal
      isOpen={isSafetyModalOpen}
      onConfirm={() => void handleConfirmSession()}
      onCancel={() => setIsSafetyModalOpen(false)}
    />
  );

  if (stealth) {
    return (
      <>
        {safetyModal}
        <StealthHUD
          opacity={stealthOpacity}
          onOpacityChange={setStealthOpacity}
          liveStatus={liveStatus}
          listening={audio.isRecording}
          suggestion={stealthSuggestion}
          onToggleListen={() => toggleLive()}
          onExitStealth={() => setStealth(false)}
          onEndSession={() => void endSession()}
          ending={ending}
          canEnd={transcript.length > 0}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {safetyModal}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-[0_0_60px_rgba(45,212,191,0.08)] backdrop-blur-xl transition-all duration-300">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
              {audio.isRecording ? (
                <>
                  <span className="live-dot inline-block h-2 w-2 rounded-full bg-teal-400" />
                  <span className="text-teal-400">Live · {liveStatus}</span>
                </>
              ) : (
                <span>Standby</span>
              )}
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-slate-100 md:text-4xl">
              {profile.jobTitle || "Interview"}
              {profile.company ? (
                <span className="text-slate-500"> · {profile.company}</span>
              ) : null}
            </h1>
            <p className="max-w-xl text-sm text-slate-400">
              Toggle Stealth Mode for a frameless, adjustable-opacity HUD during
              screen shares.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="mr-1 flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={includeSystemAudio}
                disabled={audio.isRecording}
                onChange={(e) => setIncludeSystemAudio(e.target.checked)}
              />
              System/tab audio
            </label>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStealth(true)}
              className="border-teal-500/30 text-teal-300"
            >
              Stealth mode
            </Button>
            <Button
              type="button"
              variant={audio.isRecording ? "ghost" : "primary"}
              onClick={() => toggleLive()}
            >
              {audio.isRecording ? "Pause mic" : "Start live copilot"}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={endSession}
              disabled={ending || transcript.length === 0}
            >
              {ending ? "Saving…" : "End & review"}
            </Button>
          </div>
        </div>

        <div className="relative mt-5">
          <AudioVisualizer level={audio.level} active={audio.isRecording} />
        </div>
      </section>

      {(audio.error || stt.error || copilotError) && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {audio.error || stt.error || copilotError?.message}
        </p>
      )}

      <section className="grid gap-5 lg:grid-cols-2 lg:items-stretch">
        <LiveTranscriptFeed
          entries={transcript}
          footer={
            <form
              className="flex gap-2 border-t border-slate-800 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                const text = manual.trim();
                if (!text) return;
                void submitManual(text);
                setManual("");
              }}
            >
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Or type an interviewer question…"
                className="flex-1 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-teal-500/50"
              />
              <button
                type="submit"
                disabled={isLoading || !manual.trim()}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 transition disabled:opacity-40"
              >
                Coach
              </button>
            </form>
          }
        />
        <StreamingSuggestions
          completion={aiSuggestions}
          isLoading={isLoading}
          savedPoints={savedPoints}
        />
      </section>
    </div>
  );
}
