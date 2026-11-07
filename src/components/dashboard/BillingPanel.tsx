"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PLANS,
  type CreditPackId,
  type SubscriptionPlanId,
} from "@/lib/billingCatalog";

type BillingPanelProps = {
  creditsRemaining?: number | null;
  subscriptionStatus?: string | null;
  onRefresh?: () => void;
};

export function BillingPanel({
  creditsRemaining,
  subscriptionStatus,
  onRefresh,
}: BillingPanelProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(body: {
    mode: "subscription" | "payment";
    planId?: SubscriptionPlanId;
    packId?: CreditPackId;
  }) {
    const email = session?.user?.email;
    if (!email) {
      setError("Sign in to purchase.");
      return;
    }
    setLoading(body.planId || body.packId || body.mode);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: session.user?.name || undefined,
          ...body,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Checkout failed");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoading(null);
    }
  }

  return (
    <GlassPanel className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
            Billing
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--ink)]">
            Plan & credits
          </h2>
        </div>
        <div className="text-right">
          <p className="font-[family-name:var(--font-mono)] text-2xl text-[var(--accent)]">
            {creditsRemaining ?? "—"}
          </p>
          <p className="text-xs text-[var(--muted)]">minutes left</p>
        </div>
      </div>

      <p className="text-sm text-[var(--muted)]">
        Status:{" "}
        <span className="text-[var(--ink)]">
          {subscriptionStatus || "inactive"}
        </span>
        . Pro $29/mo · Unlimited $79/mo — Stripe webhooks sync credits.
      </p>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(SUBSCRIPTION_PLANS) as SubscriptionPlanId[]).map(
          (planId) => (
            <Button
              key={planId}
              type="button"
              disabled={!!loading}
              onClick={() =>
                void startCheckout({ mode: "subscription", planId })
              }
            >
              {loading === planId
                ? "Redirecting…"
                : `${SUBSCRIPTION_PLANS[planId].name} ${SUBSCRIPTION_PLANS[planId].priceLabel}/mo`}
            </Button>
          ),
        )}
        {(Object.keys(CREDIT_PACKS) as CreditPackId[]).map((packId) => (
          <Button
            key={packId}
            type="button"
            variant="ghost"
            disabled={!!loading}
            onClick={() => void startCheckout({ mode: "payment", packId })}
          >
            {loading === packId ? "Redirecting…" : CREDIT_PACKS[packId].label}
          </Button>
        ))}
        {onRefresh ? (
          <Button type="button" variant="ghost" onClick={onRefresh}>
            Refresh
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : null}
    </GlassPanel>
  );
}
