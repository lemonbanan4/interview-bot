"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionDebrief } from "@/components/dashboard/SessionDebrief";
import { loadSession } from "@/lib/storage";
import type { InterviewSession } from "@/lib/types";

export function SessionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const local = loadSession(id);
    if (local) {
      setSession(local);
      setReady(true);
    }

    void fetch(`/api/sessions/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) return null;
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error || "Failed to load session");
        }
        const data = (await res.json()) as { session?: InterviewSession };
        return data.session ?? null;
      })
      .then((remote) => {
        if (cancelled) return;
        if (remote) setSession(remote);
        else if (!local) setError("Session not found.");
        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!local) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!ready) return <div className="skeleton h-80 rounded-2xl" />;

  if (!session) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-[var(--muted)]">{error || "Session not found."}</p>
        <Link href="/dashboard" className="text-[var(--accent)]">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Debrief failed to render">
      <SessionDebrief session={session} />
    </ErrorBoundary>
  );
}
