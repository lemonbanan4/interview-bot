"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BillingPanel } from "@/components/dashboard/BillingPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { formatDuration } from "@/lib/report";
import { deleteSession, loadSessions } from "@/lib/storage";
import type { InterviewSession } from "@/lib/types";

type BillingMe = {
  creditsRemaining: number;
  subscriptionStatus: string;
};

export default function DashboardPage() {
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [billing, setBilling] = useState<BillingMe | null>(null);
  const [ready, setReady] = useState(false);

  const refreshBilling = useCallback(() => {
    void fetch("/api/billing/me")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as BillingMe;
      })
      .then((data) => setBilling(data))
      .catch(() => setBilling(null));
  }, []);

  useEffect(() => {
    const local = loadSessions();
    void fetch("/api/sessions")
      .then(async (res) => {
        if (!res.ok) return [] as InterviewSession[];
        const data = (await res.json()) as { sessions?: InterviewSession[] };
        return data.sessions || [];
      })
      .then((remote) => {
        const byId = new Map<string, InterviewSession>();
        for (const s of [...remote, ...local]) byId.set(s.id, s);
        setSessions(
          [...byId.values()].sort((a, b) => b.createdAt - a.createdAt),
        );
        setReady(true);
      })
      .catch(() => {
        setSessions(local);
        setReady(true);
      });

    refreshBilling();
  }, [refreshBilling]);

  function remove(id: string) {
    deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  if (!ready) return <div className="skeleton h-64 rounded-2xl" />;

  return (
    <ErrorBoundary fallbackTitle="Dashboard failed to render">
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
          Review
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold text-[var(--ink)]">
          Post-interview dashboard
        </h1>
        <p className="text-[var(--muted)]">
          Open a session debrief for scorecard, transcript, strengths/weaknesses,
          and markdown export — or{" "}
          <Link href="/dashboard/chat" className="text-[var(--accent)]">
            practice with the AI mentor
          </Link>
          .
        </p>
      </section>

      <BillingPanel
        creditsRemaining={billing?.creditsRemaining}
        subscriptionStatus={billing?.subscriptionStatus}
        onRefresh={refreshBilling}
      />

      {sessions.length === 0 ? (
        <GlassPanel className="px-6 py-16 text-center">
          <p className="text-[var(--muted)]">No sessions yet.</p>
          <Link
            href="/session"
            className="mt-4 inline-flex text-sm text-[var(--accent)]"
          >
            Run a live session
          </Link>
        </GlassPanel>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <GlassPanel className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 space-y-1">
                  <Link
                    href={`/dashboard/${session.id}`}
                    className="block truncate font-[family-name:var(--font-display)] text-lg text-[var(--ink)] hover:text-[var(--accent)]"
                  >
                    {session.jobTitle}
                    {session.company ? ` @ ${session.company}` : ""}
                  </Link>
                  <p className="text-sm text-[var(--muted)]">
                    {new Date(session.createdAt).toLocaleString()} ·{" "}
                    {formatDuration(session)} · {session.transcript.length} lines
                    {session.review
                      ? ` · score ${session.review.score}`
                      : " · no score"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {session.review ? (
                    <ScorePill score={session.review.score} />
                  ) : null}
                  <Link
                    href={`/dashboard/${session.id}`}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-[var(--ink)]"
                  >
                    Open debrief
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(session.id)}
                    className="rounded-lg px-3 py-1.5 text-sm text-[var(--danger)]"
                  >
                    Delete
                  </button>
                </div>
              </GlassPanel>
            </li>
          ))}
        </ul>
      )}
    </div>
    </ErrorBoundary>
  );
}

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "text-[var(--accent)] bg-[var(--accent-soft)]"
      : score >= 60
        ? "text-[var(--warn)] bg-[var(--warn)]/10"
        : "text-[var(--danger)] bg-[var(--danger)]/10";
  return (
    <span
      className={`rounded-full px-3 py-1 font-[family-name:var(--font-mono)] text-sm ${tone}`}
    >
      {score}
    </span>
  );
}
