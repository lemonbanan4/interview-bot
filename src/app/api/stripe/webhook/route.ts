import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe, subscriptionCredits } from "@/lib/stripe";

/**
 * Stripe webhook — verifies signature, then syncs User billing fields.
 * Configure endpoint: POST /api/stripe/webhook
 * Events: checkout.session.completed (+ subscription lifecycle)
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe signature or STRIPE_WEBHOOK_SECRET" },
      { status: 400 },
    );
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid Stripe signature";
    console.error("stripe webhook signature error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe webhook handler error:", error);
    const message =
      error instanceof Error ? error.message : "Webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const user = await resolveUser(session);
  if (!user) {
    console.warn("checkout.session.completed: no matching user", {
      sessionId: session.id,
      customer: session.customer,
      clientReferenceId: session.client_reference_id,
    });
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  const meta = session.metadata || {};
  const type = meta.type || (session.mode === "subscription" ? "subscription" : "credits");
  const creditsToAdd = Number(meta.credits || 0);

  if (type === "subscription" || session.mode === "subscription") {
    const planId = meta.planId || "pro";
    const grant =
      Number.isFinite(creditsToAdd) && creditsToAdd > 0
        ? Math.round(creditsToAdd)
        : subscriptionCredits(planId);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: planId === "unlimited" ? "unlimited" : "active",
        plan: planId === "unlimited" ? "unlimited" : "pro",
        stripeCustomerId: customerId || user.stripeCustomerId,
        creditsRemaining: { increment: grant },
      },
    });
    return;
  }

  // One-time credit pack purchase
  const grant =
    Number.isFinite(creditsToAdd) && creditsToAdd > 0
      ? Math.round(creditsToAdd)
      : 60;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: customerId || user.stripeCustomerId,
      creditsRemaining: { increment: grant },
      // Keep subscriptionStatus as-is for credit-only purchases
    },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const user = await findUserByCustomer(subscription.customer);
  if (!user) return;

  const status = mapSubscriptionStatus(subscription.status);
  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: status },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const user = await findUserByCustomer(subscription.customer);
  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: "canceled" },
  });
}

async function resolveUser(session: Stripe.Checkout.Session) {
  if (session.client_reference_id) {
    const byId = await prisma.user.findUnique({
      where: { id: session.client_reference_id },
    });
    if (byId) return byId;
  }

  if (session.metadata?.userId) {
    const byMeta = await prisma.user.findUnique({
      where: { id: session.metadata.userId },
    });
    if (byMeta) return byMeta;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (customerId) {
    const byCustomer = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });
    if (byCustomer) return byCustomer;
  }

  const email =
    session.customer_details?.email ||
    session.customer_email ||
    undefined;
  if (email) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  return null;
}

async function findUserByCustomer(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
) {
  const customerId = typeof customer === "string" ? customer : customer?.id;
  if (!customerId) return null;
  return prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "canceled";
    default:
      return "inactive";
  }
}
