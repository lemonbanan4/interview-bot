import {
  INTERVIEW_COACH_SYSTEM,
  buildCoachUserPrompt,
  buildReviewPrompt,
} from "./prompts";

export type CopilotContext = {
  resumeText: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  recentTranscript: string;
  latestUtterance: string;
};

export type CopilotPayload = {
  title: string;
  bullets: string[];
};

export type ReviewPayload = {
  summary: string;
  score: number;
  strengths: string[];
  improvements: string[];
  highlights: string[];
  metrics: {
    technicalAccuracy: number;
    communicationClarity: number;
    pacingAndConfidence: number;
  };
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function getOpenAIConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || "gpt-4o",
  };
}

export async function chatJson<T>(
  messages: ChatMessage[],
  fallback: () => T,
): Promise<{ data: T; mocked: boolean }> {
  const { apiKey, model } = getOpenAIConfig();
  if (!apiKey) return { data: fallback(), mocked: true };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty model response");
  return { data: JSON.parse(content) as T, mocked: false };
}

/** Stream OpenAI tokens as SSE `token` events, then a final `result` JSON event. */
export async function streamCopilot(
  context: CopilotContext,
  write: (event: string, data: unknown) => void,
): Promise<void> {
  const { apiKey, model } = getOpenAIConfig();
  const prompt = buildCoachUserPrompt(context);

  if (!apiKey) {
    const mock = mockCoach(context.latestUtterance);
    write("status", { stage: "mock" });
    for (const bullet of mock.bullets) {
      write("bullet", { text: bullet });
      await delay(80);
    }
    write("result", mock);
    return;
  }

  write("status", { stage: "thinking" });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      stream: true,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: INTERVIEW_COACH_SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`OpenAI stream error ${response.status}: ${await response.text()}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assembled = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = parsed.choices?.[0]?.delta?.content || "";
        if (token) {
          assembled += token;
          write("token", { text: token });
        }
      } catch {
        /* ignore partial frames */
      }
    }
  }

  const result = normalizeCopilot(JSON.parse(assembled));
  write("result", result);
}

export async function generateReview(input: {
  resumeText: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  transcript: Array<{ role: string; text: string }>;
}): Promise<{ data: ReviewPayload; mocked: boolean }> {
  const lines = input.transcript
    .map((entry) => `${entry.role}: ${entry.text}`)
    .join("\n");

  const { data, mocked } = await chatJson<Partial<ReviewPayload>>(
    [
      {
        role: "system",
        content:
          "You review interview transcripts and return structured JSON feedback.",
      },
      {
        role: "user",
        content: buildReviewPrompt({
          resumeText: input.resumeText,
          jobTitle: input.jobTitle,
          company: input.company,
          jobDescription: input.jobDescription,
          transcript: lines,
        }),
      },
    ],
    () => mockReview(input.transcript.length),
  );

  const score = clampScore(data.score);
  const metricsRaw =
    data.metrics && typeof data.metrics === "object"
      ? (data.metrics as Record<string, unknown>)
      : {};

  return {
    mocked,
    data: {
      summary: String(data.summary || "No summary available."),
      score,
      strengths: asStringArray(data.strengths),
      improvements: asStringArray(data.improvements),
      highlights: asStringArray(data.highlights),
      metrics: {
        technicalAccuracy: clampScore(
          metricsRaw.technicalAccuracy ?? score - 2,
        ),
        communicationClarity: clampScore(
          metricsRaw.communicationClarity ?? score - 4,
        ),
        pacingAndConfidence: clampScore(
          metricsRaw.pacingAndConfidence ?? score - 3,
        ),
      },
    },
  };
}

export function mockCoach(latestUtterance: string): CopilotPayload {
  const lower = latestUtterance.toLowerCase();
  if (lower.includes("yourself") || lower.includes("introduce")) {
    return {
      title: "Elevator intro",
      bullets: [
        "Open with current role + years of impact",
        "Name 1–2 wins that match this job",
        "Close with why this company/role now",
      ],
    };
  }
  if (lower.includes("weakness") || lower.includes("improve")) {
    return {
      title: "Honest growth edge",
      bullets: [
        "Pick a real, non-fatal weakness",
        "Show the system you use to improve",
        "Share a recent proof point of progress",
      ],
    };
  }
  if (
    lower.includes("challenge") ||
    lower.includes("conflict") ||
    lower.includes("difficult")
  ) {
    return {
      title: "STAR story",
      bullets: [
        "Situation: set stakes in one sentence",
        "Action: emphasize your decisions",
        "Result: quantify the outcome if you can",
      ],
    };
  }
  return {
    title: "Stay crisp",
    bullets: [
      "Answer the question asked first",
      "Tie one claim back to the job needs",
      "Offer a short example, then pause",
    ],
  };
}

export function mockReview(transcriptLength: number): ReviewPayload {
  const score = Math.round(
    Math.min(92, 58 + Math.min(transcriptLength, 20) * 1.5),
  );
  return {
    summary:
      "Solid structure overall. Answers stayed relevant to the role, with room to add sharper metrics and tighter closings.",
    score,
    metrics: {
      technicalAccuracy: clampScore(score + 4),
      communicationClarity: clampScore(score - 3),
      pacingAndConfidence: clampScore(score - 1),
    },
    strengths: [
      "Clear communication under pressure",
      "Good instinct to map experience to the job",
      "Maintained a calm, professional tone",
    ],
    improvements: [
      "Lead with the outcome before the backstory",
      "Add 1–2 quantified results per example",
      "Practice a 20-second closing ask",
    ],
    highlights: [
      "Strongest stretch was when you connected past work to the target role",
      "Opportunities to deepen technical depth on follow-ups",
    ],
  };
}

function clampScore(value: unknown): number {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function normalizeCopilot(value: Partial<CopilotPayload>): CopilotPayload {
  return {
    title: String(value.title || "Talking points").slice(0, 80),
    bullets: asStringArray(value.bullets).slice(0, 5),
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).slice(0, 6);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
