import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type BillingUser = {
  id: string;
  email: string | null;
  subscriptionStatus: string;
  creditsRemaining: number;
};

/**
 * Require a signed-in user with at least `cost` credits.
 * Returns the user or a NextResponse error (402/401).
 */
export async function requireCredits(
  cost = 1,
): Promise<BillingUser | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in required", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      subscriptionStatus: true,
      creditsRemaining: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  if (user.creditsRemaining < cost) {
    return NextResponse.json(
      {
        error: "Out of credits. Upgrade or buy a pack to continue.",
        code: "INSUFFICIENT_CREDITS",
        creditsRemaining: user.creditsRemaining,
      },
      { status: 402 },
    );
  }

  return user;
}

export function isCreditsError(
  value: BillingUser | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}

/** Atomically decrement credits; no-op if already insufficient. */
export async function consumeCredits(
  userId: string,
  cost = 1,
): Promise<number> {
  const updated = await prisma.user.updateMany({
    where: { id: userId, creditsRemaining: { gte: cost } },
    data: { creditsRemaining: { decrement: cost } },
  });
  if (updated.count === 0) return -1;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditsRemaining: true },
  });
  return user?.creditsRemaining ?? -1;
}
