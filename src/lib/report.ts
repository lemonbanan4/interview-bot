import type { InterviewSession } from "./types";

export function formatDuration(session: InterviewSession): string {
  if (!session.endedAt) return "—";
  const mins = Math.max(
    1,
    Math.round((session.endedAt - session.createdAt) / 60000),
  );
  return `${mins} min${mins === 1 ? "" : "s"}`;
}

export function exportSessionMarkdown(session: InterviewSession): void {
  const review = session.review;
  const metrics = review?.metrics;
  const date = new Date(session.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const md = `# Interview Feedback Report: ${session.jobTitle} at ${session.company}
- Date: ${date}
- Duration: ${formatDuration(session)}
- Overall Score: ${review?.score ?? "—"}/100

## Summary
${review?.summary || "No automated summary available."}

## Scorecard
- Technical Accuracy: ${metrics?.technicalAccuracy ?? "—"}%
- Communication Clarity: ${metrics?.communicationClarity ?? "—"}%
- Pacing & Confidence: ${metrics?.pacingAndConfidence ?? "—"}%

## Key Strengths
${(review?.strengths || []).map((s) => `- ${s}`).join("\n") || "- —"}

## Areas for Improvement
${(review?.improvements || []).map((i) => `- ${i}`).join("\n") || "- —"}

## Highlights
${(review?.highlights || []).map((h) => `- ${h}`).join("\n") || "- —"}

## Transcript
${
  session.transcript
    .map((entry) => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      return `**${labelRole(entry.role)}** (${time}): ${entry.text}`;
    })
    .join("\n\n") || "_Empty transcript_"
}
`;

  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `interview-report-${slug(session.company || session.jobTitle || "session")}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function labelRole(role: string): string {
  if (role === "interviewer") return "Interviewer";
  if (role === "candidate") return "Candidate";
  return "System";
}

function slug(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
