/** One-time credit packs (minutes). */
export const CREDIT_PACKS = {
  starter: { credits: 60, label: "Starter — 60 minutes", priceLabel: "$19" },
  pro: { credits: 180, label: "Pro pack — 180 minutes", priceLabel: "$49" },
  studio: { credits: 500, label: "Studio — 500 minutes", priceLabel: "$99" },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

export function isCreditPackId(value: string): value is CreditPackId {
  return value in CREDIT_PACKS;
}

/**
 * Monthly subscription plans shown on the landing page.
 * Map env Stripe Price IDs: STRIPE_PRICE_PRO / STRIPE_PRICE_UNLIMITED
 */
export const SUBSCRIPTION_PLANS = {
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 29,
    priceLabel: "$29",
    interval: "mo",
    credits: 300,
    blurb: "Live HUD, mentor chat, and scored debriefs for active job seekers.",
    features: [
      "300 coaching minutes / month",
      "Stealth HUD + desktop overlay",
      "AI mentor mock interviews",
      "Session scorecards & Markdown export",
    ],
    cta: "Start Pro",
    highlighted: false,
  },
  unlimited: {
    id: "unlimited",
    name: "Unlimited",
    priceMonthly: 79,
    priceLabel: "$79",
    interval: "mo",
    credits: 10_000,
    blurb: "Unlimited practice + priority coaching for power interviewers.",
    features: [
      "Essentially unlimited minutes",
      "Everything in Pro",
      "Priority STT + GPT-4o coaching",
      "Multi-role profiles & exports",
    ],
    cta: "Go Unlimited",
    highlighted: true,
  },
} as const;

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;

export function isSubscriptionPlanId(
  value: string,
): value is SubscriptionPlanId {
  return value in SUBSCRIPTION_PLANS;
}

export function subscriptionCredits(planId?: string): number {
  if (planId && isSubscriptionPlanId(planId)) {
    return SUBSCRIPTION_PLANS[planId].credits;
  }
  const raw = Number(process.env.STRIPE_SUBSCRIPTION_CREDITS || 300);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 300;
}

export function priceEnvForPlan(planId: SubscriptionPlanId): string {
  if (planId === "unlimited") {
    return (
      process.env.STRIPE_PRICE_UNLIMITED ||
      process.env.STRIPE_PRICE_SUBSCRIPTION ||
      ""
    );
  }
  return (
    process.env.STRIPE_PRICE_PRO ||
    process.env.STRIPE_PRICE_SUBSCRIPTION ||
    ""
  );
}
