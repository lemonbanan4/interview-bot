import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import {
  consumeCredits,
  isCreditsError,
  requireCredits,
} from "@/lib/credits";

type ChatTurn = { role: "user" | "assistant"; content: string };

type GuidanceBody = {
  messages: ChatTurn[];
  resumeText?: string;
  jobTitle?: string;
  company?: string;
  jobDescription?: string;
  aiPersona?: string;
};

/**
 * Pre-interview AI mentor chat (mock Q&A + tailored prep advice).
 * Returns a plain text stream for the GuidanceChat drawer.
 */
export async function POST(request: Request) {
  try {
    const gate = await requireCredits(1);
    if (isCreditsError(gate)) return gate;

    const body = (await request.json()) as GuidanceBody;
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resume = (body.resumeText || "").trim().slice(0, 3500);
    const jd = (body.jobDescription || "").trim().slice(0, 2500);
    const role = body.jobTitle || "the target role";
    const company = body.company || "the company";
    const persona = body.aiPersona || "concise";

    const system = `You are Signal Mentor — an elite interview coach helping the candidate prepare BEFORE the live interview.

Context:
- Role: ${role} at ${company}
- Preferred answer persona: ${persona}
- Resume excerpt: ${resume || "(not provided yet)"}
- Job description excerpt: ${jd || "(not provided yet)"}

Behavior:
- Run realistic mock interviewer questions when asked to practice
- Give concise, actionable feedback on the candidate's answers
- Match coaching tone to the ${persona} persona
- Ground advice in their resume + JD keywords
- Prefer short paragraphs and bullet lists
- Never invent employers or metrics not implied by the resume
- If resume/JD are missing, ask for them briefly then continue with general coaching`;

    const lastUser =
      [...messages].reverse().find((m) => m.role === "user")?.content || "";

    if (!process.env.OPENAI_API_KEY) {
      return new Response(mockGuidance(lastUser, role, company), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    await consumeCredits(gate.id, 1);

    const result = streamText({
      model: openai(process.env.OPENAI_MODEL || "gpt-4o"),
      system,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.5,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("guidance route error:", error);
    return new Response(
      error instanceof Error ? error.message : "Guidance failed",
      { status: 500 },
    );
  }
}

function mockGuidance(prompt: string, role: string, company: string): string {
  const lower = prompt.toLowerCase();
  if (
    lower.includes("mock") ||
    lower.includes("question") ||
    lower.includes("practice")
  ) {
    return `Mock interviewer (${company} — ${role}):

"Walk me through a project where you owned an ambiguous problem end-to-end. What tradeoffs did you make?"

Answer with STAR in ~90 seconds. Paste your answer and I'll critique pacing, metrics, and JD alignment.`;
  }
  return `Prep focus for ${role} @ ${company}:

- Lead with outcomes before process
- Map 2 resume wins to JD keywords
- Prepare one crisp "why us / why now" close
- Practice a 20-second version of your intro

Ask me to run a mock round, critique an answer, or drill a weak spot.`;
}
