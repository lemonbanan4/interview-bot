import type {
  InterviewReview,
  InterviewSession,
  TalkingPoint,
  TranscriptEntry,
} from "@/lib/types";

export type SaveSessionPayload = {
  clientSessionId: string;
  jobTitle: string;
  company: string;
  duration: string;
  overallScore: number | null;
  strengths: string[];
  improvements: string[];
  transcripts: Array<{
    speaker: string;
    text: string;
    timestamp: string;
  }>;
  scorecard: {
    technicalAccuracy: number;
    communicationClarity: number;
    pacingAndConfidence: number;
  } | null;
};

/** Build the API payload from in-memory session + review data. */
export function buildSaveSessionPayload(input: {
  clientSessionId: string;
  jobTitle: string;
  company: string;
  createdAt: number;
  endedAt: number;
  transcript: TranscriptEntry[];
  talkingPoints: TalkingPoint[];
  review?: InterviewReview;
}): SaveSessionPayload {
  const durationMins = Math.max(
    1,
    Math.round((input.endedAt - input.createdAt) / 60000),
  );

  const transcripts = [
    ...input.transcript.map((entry) => ({
      speaker: roleToSpeaker(entry.role),
      text: entry.text,
      timestamp: formatClock(entry.timestamp, input.createdAt),
    })),
    ...input.talkingPoints.map((point) => ({
      speaker: "AI Copilot",
      text: `Suggested (${point.title}): ${point.bullets.join(" · ")}`,
      timestamp: formatClock(point.createdAt, input.createdAt),
    })),
  ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return {
    clientSessionId: input.clientSessionId,
    jobTitle: input.jobTitle,
    company: input.company,
    duration: `${durationMins} min${durationMins === 1 ? "" : "s"}`,
    overallScore: input.review?.score ?? null,
    strengths: input.review?.strengths ?? [],
    improvements: input.review?.improvements ?? [],
    transcripts,
    scorecard: input.review?.metrics
      ? {
          technicalAccuracy: input.review.metrics.technicalAccuracy,
          communicationClarity: input.review.metrics.communicationClarity,
          pacingAndConfidence: input.review.metrics.pacingAndConfidence,
        }
      : null,
  };
}

/** POST completed session to Prisma-backed /api/sessions/save. */
export async function saveSessionToServer(
  session: InterviewSession,
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  if (!session.endedAt) {
    return { ok: false, error: "Session has not ended yet" };
  }

  const payload = buildSaveSessionPayload({
    clientSessionId: session.id,
    jobTitle: session.jobTitle,
    company: session.company,
    createdAt: session.createdAt,
    endedAt: session.endedAt,
    transcript: session.transcript,
    talkingPoints: session.talkingPoints,
    review: session.review,
  });

  try {
    const response = await fetch("/api/sessions/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      return { ok: false, error: data.error || "Save failed" };
    }
    return { ok: true, sessionId: String(data.session?.id || "") };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Save failed",
    };
  }
}

function roleToSpeaker(role: TranscriptEntry["role"]): string {
  if (role === "candidate") return "Candidate";
  if (role === "interviewer") return "Interviewer";
  return "AI Copilot";
}

function formatClock(absoluteMs: number, sessionStartMs: number): string {
  const elapsed = Math.max(0, absoluteMs - sessionStartMs);
  const totalSec = Math.floor(elapsed / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
