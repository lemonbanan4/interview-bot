import Stripe from "stripe";

export {
  CREDIT_PACKS,
  isCreditPackId,
  isSubscriptionPlanId,
  priceEnvForPlan,
  subscriptionCredits,
  SUBSCRIPTION_PLANS,
  type CreditPackId,
  type SubscriptionPlanId,
} from "@/lib/billingCatalog";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: "2026-10-28.endive",
      typescript: true,
    });
  }
  return stripeClient;
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
