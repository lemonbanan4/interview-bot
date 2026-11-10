import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/email/cronAuth";
import { sweepWeeklyTips } from "@/lib/email/lifecycle";
import { sweepWeeklyProgressDigests } from "@/lib/email/weeklyDigest";
import { logError, logEvent } from "@/lib/telemetry";

/**
 * Weekly digest worker — interview progress summaries + tip digests.
 * Secure with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  if (!assertCronAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  try {
    const [progress, tips] = await Promise.all([
      sweepWeeklyProgressDigests(80),
      sweepWeeklyTips(40),
    ]);

    logEvent("cron.weekly_digest", {
      ok: true,
      progressSent: progress.sent,
      progressFailed: progress.failed,
      tipsSent: tips,
    });

    return NextResponse.json({
      ok: true,
      progress,
      tips,
    });
  } catch (error) {
    logError("cron.weekly_digest.error", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Weekly digest failed",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
