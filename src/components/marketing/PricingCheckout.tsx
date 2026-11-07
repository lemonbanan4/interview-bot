"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
} from "@/lib/billingCatalog";

export function PricingCheckout() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState<SubscriptionPlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(planId: SubscriptionPlanId) {
    if (!session?.user?.email) {
      router.push(`/login?callbackUrl=${encodeURIComponent("/#pricing")}`);
      return;
    }
    setLoading(planId);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "subscription",
          planId,
          email: session.user.email,
          name: session.user.name || undefined,
          successPath: "/dashboard?checkout=success",
          cancelPath: "/#pricing",
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
    <div id="pricing" className="scroll-mt-24">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
        {(Object.keys(SUBSCRIPTION_PLANS) as SubscriptionPlanId[]).map(
          (planId) => {
            const plan = SUBSCRIPTION_PLANS[planId];
            return (
              <article
                key={planId}
                className={`relative flex flex-col rounded-3xl border p-7 backdrop-blur-xl transition ${
                  plan.highlighted
                    ? "border-emerald-400/40 bg-emerald-500/10 shadow-[0_0_60px_rgba(16,185,129,0.15)]"
                    : "border-white/10 bg-slate-950/70"
                }`}
              >
                {plan.highlighted ? (
                  <span className="absolute -top-3 right-6 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                    Most popular
                  </span>
                ) : null}
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {plan.name}
                </p>
                <p className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold text-slate-50">
                  {plan.priceLabel}
                  <span className="text-base font-normal text-slate-500">
                    /{plan.interval}
                  </span>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  {plan.blurb}
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={!!loading}
                  onClick={() => void checkout(planId)}
                  className={`mt-8 rounded-xl px-5 py-3 text-sm font-semibold transition ${
                    plan.highlighted
                      ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                      : "border border-white/15 bg-white/5 text-slate-100 hover:border-emerald-400/40"
                  } disabled:opacity-50`}
                >
                  {loading === planId ? "Redirecting…" : plan.cta}
                </button>
              </article>
            );
          },
        )}
      </div>
      {error ? (
        <p className="mt-4 text-center text-sm text-rose-300">{error}</p>
      ) : null}
    </div>
  );
}
