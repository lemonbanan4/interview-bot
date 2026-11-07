import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import {
  consumeCredits,
  isCreditsError,
  requireCredits,
} from "@/lib/credits";
import { INTERVIEW_COACH_SYSTEM, buildCoachUserPrompt } from "@/lib/prompts";

/**
 * Vercel AI SDK completion endpoint for useCompletion / useInterviewCopilot.
 * Body: { prompt, resumeContext?, resumeText?, jobTitle?, company?, jobDescription?, recentTranscript? }
 * Returns a plain text stream (streamProtocol: 'text' on the client).
 */
export async function POST(request: Request) {
  try {
    const gate = await requireCredits(1);
    if (isCreditsError(gate)) return gate;

    const body = (await request.json()) as {
      prompt?: string;
      resumeContext?: string;
      resumeText?: string;
      jobTitle?: string;
      company?: string;
      jobDescription?: string;
      recentTranscript?: string;
    };

    const prompt = body.prompt?.trim() || "";
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      const mock = mockStream(prompt);
      return new Response(mock, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    await consumeCredits(gate.id, 1);

    const resumeText = body.resumeText || body.resumeContext || "";
    const userPrompt = buildCoachUserPrompt({
      resumeText,
      jobTitle: body.jobTitle || "",
      company: body.company || "",
      jobDescription: body.jobDescription || "",
      recentTranscript: body.recentTranscript || "",
      latestUtterance: prompt,
    });

    const result = streamText({
      model: openai(process.env.OPENAI_MODEL || "gpt-4o"),
      system: `${INTERVIEW_COACH_SYSTEM}

For this streaming HUD endpoint, format the answer as plain text the candidate can skim:
- First line: a short title (no JSON)
- Then 3–5 lines starting with "- " for speakable talking points
Do not wrap in markdown fences or JSON.`,
      prompt: userPrompt,
      temperature: 0.4,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("copilot route error:", error);
    return new Response(
      error instanceof Error ? error.message : "Internal Server Error",
      { status: 500 },
    );
  }
}

function mockStream(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("yourself") || lower.includes("introduce")) {
    return [
      "Elevator intro",
      "- Open with current role + years of impact",
      "- Name 1–2 wins that match this job",
      "- Close with why this company/role now",
    ].join("\n");
  }
  if (lower.includes("challenge") || lower.includes("difficult")) {
    return [
      "STAR story",
      "- Situation: set stakes in one sentence",
      "- Action: emphasize your decisions",
      "- Result: quantify the outcome if you can",
    ].join("\n");
  }
  return [
    "Stay crisp",
    "- Answer the question asked first",
    "- Tie one claim back to the job needs",
    "- Offer a short example, then pause",
  ].join("\n");
}
