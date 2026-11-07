"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GuidanceChat } from "@/components/GuidanceChat";
import { loadProfile } from "@/lib/storage";
import type { InterviewProfile } from "@/lib/types";
import { emptyProfile } from "@/lib/types";

/**
 * Dedicated pre-interview mentor — mock Q&A trained on the user's resume/JD.
 */
export default function DashboardChatPage() {
  const [profile, setProfile] = useState<InterviewProfile>(emptyProfile());

  useEffect(() => {
    setProfile(loadProfile());
  }, []);

  const ready =
    profile.resumeText.trim().length > 40 &&
    profile.jobDescription.trim().length > 40;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
          Mentor
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--ink)] md:text-4xl">
          AI guidance chat
        </h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          Run simulated Q&amp;As against your resume and target role before you
          go live.{" "}
          {!ready ? (
            <>
              Load a profile on{" "}
              <Link href="/prepare" className="text-[var(--accent)]">
                Prepare
              </Link>{" "}
              or{" "}
              <Link href="/setup" className="text-[var(--accent)]">
                Setup
              </Link>{" "}
              for better answers.
            </>
          ) : (
            <>
              Coaching for{" "}
              <span className="text-[var(--ink)]">
                {profile.jobTitle || "your role"}
                {profile.company ? ` @ ${profile.company}` : ""}
              </span>
              .
            </>
          )}
        </p>
      </section>

      <GuidanceChat variant="page" profile={profile} />
    </div>
  );
}
