import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type SaveTranscriptItem = {
  speaker: "Interviewer" | "Candidate" | "AI Copilot" | string;
  text: string;
  timestamp: string;
};

type SaveScorecard = {
  technicalAccuracy: number;
  communicationClarity: number;
  pacingAndConfidence: number;
};

type SaveSessionBody = {
  /** Optional client session id (informational; DB uses cuid) */
  clientSessionId?: string;
  userEmail?: string;
  userName?: string;
  jobTitle: string;
  company?: string;
  duration?: string;
  overallScore?: number | null;
  strengths?: string[];
  improvements?: string[];
  transcripts?: SaveTranscriptItem[];
  scorecard?: SaveScorecard | null;
};

const GUEST_EMAIL = "guest@local.dev";

/**
 * Persist a completed interview session with nested transcript rows + scorecard.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveSessionBody;

    const jobTitle = body.jobTitle?.trim();
    if (!jobTitle) {
      return NextResponse.json(
        { error: "jobTitle is required" },
        { status: 400 },
      );
    }

    const strengths = Array.isArray(body.strengths) ? body.strengths : [];
    const improvements = Array.isArray(body.improvements)
      ? body.improvements
      : [];
    const transcripts = Array.isArray(body.transcripts) ? body.transcripts : [];

    const sessionAuth = await auth();
    let user =
      sessionAuth?.user?.id
        ? await prisma.user.findUnique({ where: { id: sessionAuth.user.id } })
        : null;

    if (!user) {
      const email = (
        sessionAuth?.user?.email ||
        body.userEmail?.trim() ||
        GUEST_EMAIL
      ).toLowerCase();
      user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          name:
            sessionAuth?.user?.name ||
            body.userName?.trim() ||
            email.split("@")[0] ||
            "Guest",
        },
        update: {
          name:
            sessionAuth?.user?.name || body.userName?.trim() || undefined,
        },
      });
    }

    const session = await prisma.interviewSession.create({
      data: {
        userId: user.id,
        jobTitle,
        company: body.company?.trim() || null,
        duration: body.duration?.trim() || null,
        overallScore:
          typeof body.overallScore === "number" ? body.overallScore : null,
        strengths,
        improvements,
        transcripts: {
          create: transcripts
            .filter((item) => item.text?.trim())
            .map((item) => ({
              speaker: item.speaker || "Interviewer",
              text: item.text.trim(),
              timestamp: item.timestamp || "00:00",
            })),
        },
        scorecard: body.scorecard
          ? {
              create: {
                technicalAccuracy: clamp(body.scorecard.technicalAccuracy),
                communicationClarity: clamp(
                  body.scorecard.communicationClarity,
                ),
                pacingAndConfidence: clamp(
                  body.scorecard.pacingAndConfidence,
                ),
              },
            }
          : undefined,
      },
      include: {
        transcripts: { orderBy: { createdAt: "asc" } },
        scorecard: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    return NextResponse.json({ ok: true, session });
  } catch (error) {
    console.error("sessions/save error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}
