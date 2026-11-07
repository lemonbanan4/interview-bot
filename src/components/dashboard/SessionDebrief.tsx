"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { exportSessionMarkdown, formatDuration } from "@/lib/report";
import type { InterviewSession, TalkingPoint, TranscriptEntry } from "@/lib/types";

type TimelineItem = {
  id: string;
  speaker: "Interviewer" | "Candidate" | "AI Copilot";
  text: string;
  timestamp: number;
};

export function SessionDebrief({ session }: { session: InterviewSession }) {
  const review = session.review;
  const metrics = review?.metrics ?? {
    technicalAccuracy: review?.score ?? 0,
    communicationClarity: Math.max(0, (review?.score ?? 0) - 4),
    pacingAndConfidence: Math.max(0, (review?.score ?? 0) - 2),
  };
  const dateLabel = new Date(session.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeline = buildTimeline(session.transcript, session.talkingPoints);

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-start justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center">
        <div className="space-y-2">
          <Link
            href="/dashboard"
            className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
          >
            ← All sessions
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              Session debrief
            </span>
            <span className="text-xs text-[var(--muted)]">
              {dateLabel} · {formatDuration(session)}
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--ink)] md:text-4xl">
            {session.jobTitle}{" "}
            <span className="font-normal text-[var(--muted)]">
              @ {session.company}
            </span>
          </h1>
          {review?.summary ? (
            <p className="max-w-2xl text-sm text-[var(--muted)]">{review.summary}</p>
          ) : null}
        </div>
        <Button type="button" onClick={() => exportSessionMarkdown(session)}>
          Export report (.md)
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <GlassPanel glow className="flex flex-col justify-between p-6">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Overall score
          </span>
          <div className="my-4 flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-display)] text-5xl font-semibold text-[var(--accent)]">
              {review?.score ?? "—"}
            </span>
            <span className="text-lg text-[var(--muted)]">/ 100</span>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Readiness estimate for this role based on the saved transcript.
          </p>
        </GlassPanel>

        <MetricCard
          label="Technical accuracy"
          value={metrics.technicalAccuracy}
          barClass="bg-emerald-400"
        />
        <MetricCard
          label="Communication clarity"
          value={metrics.communicationClarity}
          barClass="bg-[var(--accent)]"
        />
        <MetricCard
          label="Pacing & confidence"
          value={metrics.pacingAndConfidence}
          barClass="bg-sky-400"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <GlassPanel className="flex h-[36rem] flex-col lg:col-span-2">
          <div className="border-b border-white/10 px-5 py-4 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
            Session transcript & copilot logs
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {timeline.length === 0 ? (
              <p className="text-sm italic text-[var(--muted)]">
                No transcript captured for this session.
              </p>
            ) : (
              timeline.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 ${speakerStyles(item.speaker)}`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em]">
                      {item.speaker}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--ink)]">
                    {item.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </GlassPanel>

        <div className="flex flex-col gap-5">
          <GlassPanel className="border-[var(--accent)]/25 p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
              Key strengths
            </h2>
            <ul className="space-y-3">
              {(review?.strengths || []).map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-[var(--ink)]"
                >
                  <span className="mt-0.5 text-[var(--accent)]">✓</span>
                  {item}
                </li>
              ))}
              {!review?.strengths?.length ? (
                <li className="text-sm text-[var(--muted)]">No strengths logged.</li>
              ) : null}
            </ul>
          </GlassPanel>

          <GlassPanel className="border-[var(--warn)]/25 p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--warn)]">
              Areas for improvement
            </h2>
            <ul className="space-y-3">
              {(review?.improvements || []).map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-[var(--ink)]"
                >
                  <span className="mt-0.5 text-[var(--warn)]">!</span>
                  {item}
                </li>
              ))}
              {!review?.improvements?.length ? (
                <li className="text-sm text-[var(--muted)]">
                  No improvements logged.
                </li>
              ) : null}
            </ul>
          </GlassPanel>

          {(review?.highlights?.length ?? 0) > 0 ? (
            <GlassPanel className="p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                Highlights
              </h2>
              <ul className="space-y-2">
                {review!.highlights.map((item) => (
                  <li key={item} className="text-sm text-[var(--ink)]">
                    {item}
                  </li>
                ))}
              </ul>
            </GlassPanel>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  barClass,
}: {
  label: string;
  value: number;
  barClass: string;
}) {
  return (
    <GlassPanel className="flex flex-col justify-between p-6">
      <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </span>
      <div className="my-4">
        <span className="font-[family-name:var(--font-display)] text-4xl font-semibold text-[var(--ink)]">
          {value}
          <span className="text-lg text-[var(--muted)]">%</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </GlassPanel>
  );
}

function speakerStyles(speaker: TimelineItem["speaker"]): string {
  if (speaker === "AI Copilot") {
    return "ml-4 border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]";
  }
  if (speaker === "Candidate") {
    return "border-white/10 bg-black/35 text-[var(--muted)]";
  }
  return "border-white/10 bg-white/[0.03] text-[var(--muted)]";
}

function buildTimeline(
  transcript: TranscriptEntry[],
  points: TalkingPoint[],
): TimelineItem[] {
  const items: TimelineItem[] = transcript.map((entry) => ({
    id: entry.id,
    speaker:
      entry.role === "candidate"
        ? "Candidate"
        : entry.role === "interviewer"
          ? "Interviewer"
          : "AI Copilot",
    text: entry.text,
    timestamp: entry.timestamp,
  }));

  for (const point of points) {
    items.push({
      id: `copilot_${point.id}`,
      speaker: "AI Copilot",
      text: `Suggested: ${point.bullets.join(" · ") || point.title}`,
      timestamp: point.createdAt,
    });
  }

  return items.sort((a, b) => a.timestamp - b.timestamp);
}
