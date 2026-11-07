import { NextResponse } from "next/server";
import {
  consumeCredits,
  isCreditsError,
  requireCredits,
} from "@/lib/credits";
import { generateReview } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    const gate = await requireCredits(2);
    if (isCreditsError(gate)) return gate;

    const body = (await request.json()) as {
      resumeText?: string;
      jobTitle?: string;
      company?: string;
      jobDescription?: string;
      transcript?: Array<{ role: string; text: string }>;
    };

    const { data, mocked } = await generateReview({
      resumeText: body.resumeText || "",
      jobTitle: body.jobTitle || "",
      company: body.company || "",
      jobDescription: body.jobDescription || "",
      transcript: body.transcript || [],
    });

    if (!mocked) {
      await consumeCredits(gate.id, 2);
    }

    return NextResponse.json({ ...data, mocked });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
