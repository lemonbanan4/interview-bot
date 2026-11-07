import {
  consumeCredits,
  isCreditsError,
  requireCredits,
} from "@/lib/credits";
import { transcribePcm } from "@/lib/deepgram";
import { mockCoach, streamCopilot, type CopilotContext } from "@/lib/llm";

type LiveBody = Partial<CopilotContext> & {
  /** Base64-encoded linear16 PCM @ 16 kHz mono */
  audioBase64?: string;
  /** Skip STT and coach directly from this text */
  text?: string;
  /** Only run Deepgram STT (HUD coaches via /api/copilot + useCompletion) */
  sttOnly?: boolean;
};

/**
 * Real-time interview pipeline over SSE:
 *   audio (or text) → Deepgram STT → GPT-4o coach → talking points
 *
 * Events: status | transcript | token | bullet | result | error | done
 */
export async function POST(request: Request) {
  const gate = await requireCredits(1);
  if (isCreditsError(gate)) return gate;

  let body: LiveBody;
  try {
    body = (await request.json()) as LiveBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  // STT-only chunks are frequent — don't burn a credit per window.
  // Full coach pipeline charges once per request.
  if (!body.sttOnly) {
    await consumeCredits(gate.id, 1);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        write("status", { stage: "received" });

        let utterance =
          body.text?.trim() || body.latestUtterance?.trim() || "";

        if (!utterance && body.audioBase64) {
          write("status", { stage: "stt" });
          utterance = await runStt(body.audioBase64, write);
        }

        if (!utterance) {
          write("status", { stage: "silence" });
          write("done", { ok: true, skipped: true });
          return;
        }

        write("transcript", { text: utterance, isFinal: true });

        if (body.sttOnly) {
          write("done", { ok: true, sttOnly: true });
          return;
        }

        const context: CopilotContext = {
          resumeText: body.resumeText || "",
          jobTitle: body.jobTitle || "",
          company: body.company || "",
          jobDescription: body.jobDescription || "",
          recentTranscript: body.recentTranscript || "",
          latestUtterance: utterance,
        };

        write("status", { stage: "coaching" });
        await streamCopilot(context, write);
        write("done", { ok: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Live pipeline failed";
        write("error", { message });
        // Always emit a usable fallback card so the HUD never blanks out.
        write("result", mockCoach(body.text || body.latestUtterance || "general"));
        write("done", { ok: false });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function runStt(
  audioBase64: string,
  write: (event: string, data: unknown) => void,
): Promise<string> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  const pcm = Buffer.from(audioBase64, "base64");

  if (!apiKey) {
    write("status", {
      stage: "stt-fallback",
      detail: "DEEPGRAM_API_KEY missing — send text or enable browser STT",
    });
    return "";
  }

  // Ignore near-silent windows (< ~0.25s)
  if (pcm.byteLength < 16000 * 2 * 0.25) {
    return "";
  }

  return transcribePcm(apiKey, pcm);
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
