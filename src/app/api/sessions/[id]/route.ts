import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

/** Load a single interview session (DB) for the signed-in user. */
export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const row = await prisma.interviewSession.findFirst({
    where: { id, userId: session.user.id },
    include: {
      scorecard: true,
      transcripts: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    session: {
      id: row.id,
      createdAt: row.createdAt.getTime(),
      endedAt: row.updatedAt.getTime(),
      jobTitle: row.jobTitle,
      company: row.company || "",
      status: "completed" as const,
      transcript: row.transcripts.map((t) => ({
        id: t.id,
        role:
          t.speaker === "Interviewer"
            ? ("interviewer" as const)
            : t.speaker === "Candidate"
              ? ("candidate" as const)
              : ("system" as const),
        text: t.text,
        timestamp: row.createdAt.getTime(),
      })),
      talkingPoints: [],
      review: {
        summary: "",
        score: row.overallScore ?? 0,
        strengths: asStringArray(row.strengths),
        improvements: asStringArray(row.improvements),
        highlights: [],
        metrics: row.scorecard
          ? {
              technicalAccuracy: row.scorecard.technicalAccuracy,
              communicationClarity: row.scorecard.communicationClarity,
              pacingAndConfidence: row.scorecard.pacingAndConfidence,
            }
          : undefined,
      },
      duration: row.duration,
      source: "db" as const,
    },
  });
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}
