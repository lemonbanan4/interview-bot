"use client";

import { useCallback, useRef, useState } from "react";
import { pcmToBase64 } from "@/hooks/useAudioCapture";
import type { InterviewProfile, TalkingPoint, TranscriptEntry } from "@/lib/types";

type LiveCopilotHandlers = {
  profile: InterviewProfile;
  onTranscript: (entry: TranscriptEntry) => void;
  onTalkingPoint: (point: TalkingPoint) => void;
};

/**
 * Posts audio windows (or typed text) to /api/live and consumes the SSE
 * pipeline: Deepgram STT → GPT-4o coach → talking points.
 */
export function useLiveCopilot({
  profile,
  onTranscript,
  onTalkingPoint,
}: LiveCopilotHandlers) {
  const [busy, setBusy] = useState(false);
  const [streamingBullets, setStreamingBullets] = useState<string[]>([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);

  const lockRef = useRef(false);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const profileRef = useRef(profile);
  const handlersRef = useRef({ onTranscript, onTalkingPoint });

  profileRef.current = profile;
  handlersRef.current = { onTranscript, onTalkingPoint };

  const setTranscriptMirror = useCallback((entries: TranscriptEntry[]) => {
    transcriptRef.current = entries;
  }, []);

  const runPipeline = useCallback(
    async (payload: { audioBase64?: string; text?: string }) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setBusy(true);
      setStreamingBullets([]);
      setError(null);
      setStatus("sending");

      try {
        const current = profileRef.current;
        const recent = transcriptRef.current
          .slice(-8)
          .map((e) => `${e.role}: ${e.text}`)
          .join("\n");

        const response = await fetch("/api/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64: payload.audioBase64,
            text: payload.text,
            resumeText: current.resumeText,
            jobTitle: current.jobTitle,
            company: current.company,
            jobDescription: current.jobDescription,
            recentTranscript: recent,
          }),
        });

        if (!response.ok || !response.body) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Live pipeline request failed");
        }

        await readSse(response.body, {
          onStatus: (stage) => setStatus(stage),
          onTranscript: (text) => {
            const entry: TranscriptEntry = {
              id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              role: "interviewer",
              text,
              timestamp: Date.now(),
            };
            handlersRef.current.onTranscript(entry);
          },
          onBullet: (text) =>
            setStreamingBullets((prev) =>
              prev.includes(text) ? prev : [...prev, text],
            ),
          onResult: (point) => {
            handlersRef.current.onTalkingPoint(point);
            setStreamingBullets([]);
          },
          onError: (message) => setError(message),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Live pipeline failed");
      } finally {
        lockRef.current = false;
        setBusy(false);
        setStatus("idle");
      }
    },
    [],
  );

  const sendPcmWindow = useCallback(
    (pcm: Int16Array) => {
      // Skip near-silent windows (very low energy)
      let energy = 0;
      for (let i = 0; i < pcm.length; i += 64) {
        energy += Math.abs(pcm[i]);
      }
      if (energy / Math.max(1, Math.floor(pcm.length / 64)) < 80) return;

      void runPipeline({ audioBase64: pcmToBase64(pcm) });
    },
    [runPipeline],
  );

  const sendText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      void runPipeline({ text: trimmed });
    },
    [runPipeline],
  );

  return {
    busy,
    streamingBullets,
    status,
    error,
    sendPcmWindow,
    sendText,
    setTranscriptMirror,
  };
}

async function readSse(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onStatus: (stage: string) => void;
    onTranscript: (text: string) => void;
    onBullet: (text: string) => void;
    onResult: (point: TalkingPoint) => void;
    onError: (message: string) => void;
  },
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      let dataLine = "";
      for (const line of lines) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;

      const data = JSON.parse(dataLine) as Record<string, unknown>;

      if (eventName === "status" && typeof data.stage === "string") {
        handlers.onStatus(data.stage);
      }
      if (eventName === "transcript" && typeof data.text === "string") {
        handlers.onTranscript(data.text);
      }
      if (eventName === "bullet" && typeof data.text === "string") {
        handlers.onBullet(data.text);
      }
      if (eventName === "result") {
        handlers.onResult({
          id: `p_${Date.now()}`,
          title: String(data.title || "Talking points"),
          bullets: Array.isArray(data.bullets) ? data.bullets.map(String) : [],
          createdAt: Date.now(),
        });
      }
      if (eventName === "error" && typeof data.message === "string") {
        handlers.onError(data.message);
      }
    }
  }
}
