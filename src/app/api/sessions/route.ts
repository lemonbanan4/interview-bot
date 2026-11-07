import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** List interview sessions for the signed-in user (Postgres-backed). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.interviewSession.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      scorecard: true,
      transcripts: { orderBy: { createdAt: "asc" } },
    },
  });

  const sessions = rows.map((row) => ({
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
  }));

  return NextResponse.json({ sessions });
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}
