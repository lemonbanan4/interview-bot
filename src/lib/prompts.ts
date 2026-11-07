/** Specialized interview coach system prompt for GPT-4o. */
export const INTERVIEW_COACH_SYSTEM = `You are Signal, an elite real-time interview copilot.

Your job: while the candidate is mid-interview, produce glanceable talking points they can speak aloud in the next 10–20 seconds.

Output constraints:
- Respond with VALID JSON only (no markdown fences)
- Shape: { "title": string (≤6 words), "bullets": string[3..5] }
- Each bullet ≤ 18 words, imperative / speakable
- Prefer STAR for behavioral prompts
- Ground claims in the provided resume when possible
- Mirror keywords from the job description
- Never invent employers, degrees, or metrics not implied by the resume
- No preamble, no apologies, no meta commentary`;

export function buildCoachUserPrompt(input: {
  resumeText: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  recentTranscript: string;
  latestUtterance: string;
}): string {
  return `Role: ${input.jobTitle || "the target role"} at ${input.company || "the company"}

Resume excerpt:
${truncate(input.resumeText, 2500)}

Job description excerpt:
${truncate(input.jobDescription, 2000)}

Recent transcript:
${input.recentTranscript || "(none yet)"}

Latest interviewer / speech utterance:
${input.latestUtterance}

Generate the JSON talking points now.`;
}

/** @deprecated alias — prefer buildCoachUserPrompt */
export function buildCoachPrompt(input: {
  resumeText: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  recentTranscript: string;
  latestUtterance: string;
}): string {
  return buildCoachUserPrompt(input);
}

export function buildReviewPrompt(input: {
  resumeText: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  transcript: string;
}): string {
  return `You are an interview coach reviewing a completed mock/live interview.

Role: ${input.jobTitle || "the target role"} at ${input.company || "the company"}

Resume excerpt:
${truncate(input.resumeText, 2500)}

Job description excerpt:
${truncate(input.jobDescription, 2000)}

Full transcript:
${input.transcript || "(empty transcript)"}

Return JSON only with this shape:
{
  "summary": "2-4 sentence overview of how the interview went",
  "score": 0,
  "metrics": {
    "technicalAccuracy": 0,
    "communicationClarity": 0,
    "pacingAndConfidence": 0
  },
  "strengths": ["up to 4 strengths"],
  "improvements": ["up to 4 concrete improvements"],
  "highlights": ["up to 3 notable moments from the transcript"]
}

score and each metrics value are integers 0-100.
Be constructive and specific. No markdown.`;
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "(not provided)";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}
