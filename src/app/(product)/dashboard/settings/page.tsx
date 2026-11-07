"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BillingPanel } from "@/components/dashboard/BillingPanel";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAppUpdater } from "@/hooks/useAppUpdater";
import { loadProfile } from "@/lib/storage";
import type { InterviewProfile } from "@/lib/types";
import { emptyProfile } from "@/lib/types";

type BillingMe = {
  creditsRemaining: number;
  subscriptionStatus: string;
};

/**
 * Desktop tray "Open Settings" target — profile shortcuts + billing.
 */
export default function DashboardSettingsPage() {
  const [profile, setProfile] = useState<InterviewProfile>(emptyProfile());
  const [billing, setBilling] = useState<BillingMe | null>(null);
  const { checkForAppUpdates, updating, status } = useAppUpdater();

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
    setProfile(loadProfile());
    refreshBilling();
  }, [refreshBilling]);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--accent)]">
          Settings
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--ink)] md:text-4xl">
          Desktop settings
        </h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          Opened from the system tray. Update your interview profile, billing,
          or jump back to the live HUD.
        </p>
      </section>

      <GlassPanel className="space-y-3 p-5">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
          Profile
        </h2>
        <p className="text-sm text-[var(--muted)]">
          {profile.jobTitle || "No role set"}
          {profile.company ? ` @ ${profile.company}` : ""}
          {profile.resumeText.trim()
            ? ` · resume loaded (${profile.resumeText.trim().length} chars)`
            : " · resume missing"}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/prepare"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--accent)]/40"
          >
            Prepare desk
          </Link>
          <Link
            href="/setup"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-[var(--ink)] transition hover:border-[var(--accent)]/40"
          >
            Setup wizard
          </Link>
          <Link
            href="/session"
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#041512] transition hover:brightness-110"
          >
            Live HUD
          </Link>
          <Link
            href="/hud"
            className="rounded-xl border border-teal-500/30 px-4 py-2 text-sm text-teal-300 transition hover:bg-teal-500/10"
          >
            Overlay surface
          </Link>
        </div>
      </GlassPanel>

      <BillingPanel
        creditsRemaining={billing?.creditsRemaining}
        subscriptionStatus={billing?.subscriptionStatus}
        onRefresh={refreshBilling}
      />

      <GlassPanel className="space-y-3 p-5 text-sm text-[var(--muted)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-[var(--ink)]">Desktop updates</p>
            <p className="text-xs">
              Signed releases via Tauri updater. Private key stays in CI only.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={updating}
            onClick={() => void checkForAppUpdates()}
          >
            {updating ? "Updating…" : "Check for updates"}
          </Button>
        </div>
        {status ? (
          <p className="text-xs text-[var(--accent)]">{status}</p>
        ) : null}
      </GlassPanel>

      <GlassPanel className="space-y-2 p-5 text-sm text-[var(--muted)]">
        <p className="font-medium text-[var(--ink)]">Desktop shortcuts</p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <span className="font-[family-name:var(--font-mono)] text-[var(--accent)]">
              ⌘⇧H
            </span>{" "}
            / Ctrl+Shift+H — toggle HUD visibility
          </li>
          <li>Tray → Toggle HUD Visibility / Open Settings / Quit</li>
          <li>Hold ⌥ while hovering the HUD to interact (click-through off)</li>
        </ul>
      </GlassPanel>
    </div>
  );
}
