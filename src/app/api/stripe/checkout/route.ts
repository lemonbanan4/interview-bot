import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CREDIT_PACKS,
  getAppUrl,
  getStripe,
  isCreditPackId,
  isSubscriptionPlanId,
  priceEnvForPlan,
  subscriptionCredits,
  type CreditPackId,
  type SubscriptionPlanId,
} from "@/lib/stripe";

type CheckoutBody = {
  email?: string;
  name?: string;
  /** subscription = recurring plan; payment = one-time credit pack */
  mode?: "subscription" | "payment";
  /** pro | unlimited for subscriptions */
  planId?: SubscriptionPlanId;
  /** Credit pack for mode=payment */
  packId?: CreditPackId;
  priceId?: string;
  successPath?: string;
  cancelPath?: string;
};

/**
 * Stripe Checkout for Pro ($29) / Unlimited ($79) subscriptions or credit packs.
 */
export async function POST(request: Request) {
  try {
    const { auth } = await import("@/auth");
    const authSession = await auth();
    const body = (await request.json()) as CheckoutBody;
    const email = (authSession?.user?.email || body.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      return NextResponse.json(
        { error: "Sign in or provide email to checkout" },
        { status: 401 },
      );
    }

    const mode = body.mode === "payment" ? "payment" : "subscription";
    const stripe = getStripe();
    const appUrl = getAppUrl();

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: body.name?.trim() || authSession?.user?.name || email.split("@")[0],
      },
      update: {
        name: body.name?.trim() || authSession?.user?.name || undefined,
      },
    });

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: user.name || undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const { priceId, metadata, credits } = resolvePriceAndMeta({
      mode,
      planId: body.planId,
      packId: body.packId,
      priceId: body.priceId,
      userId: user.id,
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode,
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}${body.successPath || "/dashboard"}?checkout=success`,
      cancel_url: `${appUrl}${body.cancelPath || "/#pricing"}?checkout=canceled`,
      metadata,
      subscription_data:
        mode === "subscription"
          ? {
              metadata: {
                userId: user.id,
                type: "subscription",
                planId: metadata.planId || "pro",
                credits: String(credits),
              },
            }
          : undefined,
      allow_promotion_codes: true,
    });

    return NextResponse.json({
      ok: true,
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      userId: user.id,
    });
  } catch (error) {
    console.error("stripe/checkout error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function resolvePriceAndMeta(input: {
  mode: "subscription" | "payment";
  planId?: string;
  packId?: string;
  priceId?: string;
  userId: string;
}): { priceId: string; metadata: Record<string, string>; credits: number } {
  if (input.mode === "subscription") {
    const planId: SubscriptionPlanId =
      input.planId && isSubscriptionPlanId(input.planId)
        ? input.planId
        : "pro";
    const priceId = input.priceId || priceEnvForPlan(planId);
    if (!priceId) {
      throw new Error(
        `Missing subscription price for ${planId}. Set STRIPE_PRICE_${planId.toUpperCase()} or STRIPE_PRICE_SUBSCRIPTION.`,
      );
    }
    const credits = subscriptionCredits(planId);
    return {
      priceId,
      credits,
      metadata: {
        userId: input.userId,
        type: "subscription",
        planId,
        credits: String(credits),
      },
    };
  }

  const packId =
    input.packId && isCreditPackId(input.packId) ? input.packId : "starter";
  const pack = CREDIT_PACKS[packId];
  const envKey = `STRIPE_PRICE_CREDITS_${packId.toUpperCase()}` as const;
  const priceId =
    input.priceId || process.env[envKey] || process.env.STRIPE_PRICE_CREDITS || "";
  if (!priceId) {
    throw new Error(
      `Missing credit pack price. Set ${envKey} (or STRIPE_PRICE_CREDITS) or pass priceId.`,
    );
  }

  return {
    priceId,
    credits: pack.credits,
    metadata: {
      userId: input.userId,
      type: "credits",
      packId,
      credits: String(pack.credits),
    },
  };
}
