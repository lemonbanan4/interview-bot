"use client";

import { useCallback, useRef, useState } from "react";
import { pcmToBase64 } from "@/hooks/useAudioCapture";

/**
 * Sends PCM windows to /api/live with sttOnly=true and returns final transcripts.
 */
export function useSttWindow(onTranscript: (text: string) => void) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const sendPcmWindow = useCallback(async (pcm: Int16Array) => {
    let energy = 0;
    for (let i = 0; i < pcm.length; i += 64) energy += Math.abs(pcm[i]);
    if (energy / Math.max(1, Math.floor(pcm.length / 64)) < 80) return;

    if (lockRef.current) return;
    lockRef.current = true;
    setStatus("stt");
    setError(null);

    try {
      const response = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: pcmToBase64(pcm),
          sttOnly: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("STT request failed");
      }

      const reader = response.body.getReader();
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
          if (eventName === "transcript" && typeof data.text === "string") {
            onTranscriptRef.current(data.text);
          }
          if (eventName === "error" && typeof data.message === "string") {
            setError(data.message);
          }
          if (eventName === "status" && typeof data.stage === "string") {
            setStatus(data.stage);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "STT failed");
    } finally {
      lockRef.current = false;
      setStatus("idle");
    }
  }, []);

  return { sendPcmWindow, status, error };
}
