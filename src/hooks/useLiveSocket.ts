"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEEPGRAM_WS_URL, parseDeepgramMessage } from "@/lib/deepgram";
import type { DeepgramTokenResponse } from "@/lib/deepgram";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

export type LiveSocketHandlers = {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onStatus?: (status: string) => void;
};

/**
 * Manages Deepgram live WebSocket STT, with Web Speech API fallback
 * when /api/transcription returns browser-fallback mode.
 */
export function useLiveSocket(handlers: LiveSocketHandlers = {}) {
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<"idle" | "deepgram" | "browser-fallback">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldRunRef = useRef(false);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const disconnect = useCallback(() => {
    shouldRunRef.current = false;

    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }

    setConnected(false);
    setMode("idle");
  }, []);

  const connectDeepgram = useCallback(async (token: string) => {
    handlersRef.current.onStatus?.("connecting-deepgram");

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(DEEPGRAM_WS_URL, ["token", token]);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setMode("deepgram");
        handlersRef.current.onStatus?.("deepgram-live");
        resolve();
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const parsed = parseDeepgramMessage(event.data);
        if (!parsed) return;
        if (parsed.isFinal) handlersRef.current.onFinal?.(parsed.transcript);
        else handlersRef.current.onInterim?.(parsed.transcript);
      };

      ws.onerror = () => {
        setError("Deepgram WebSocket error");
        reject(new Error("Deepgram WebSocket error"));
      };

      ws.onclose = () => {
        setConnected(false);
        if (shouldRunRef.current) {
          handlersRef.current.onStatus?.("deepgram-closed");
        }
      };
    });
  }, []);

  const connectBrowserFallback = useCallback(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Ctor) {
      throw new Error(
        "No Deepgram key and Web Speech API unavailable. Use Chrome/Edge or set DEEPGRAM_API_KEY.",
      );
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) handlersRef.current.onFinal?.(text);
        else interim += `${text} `;
      }
      if (interim) handlersRef.current.onInterim?.(interim.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      setError(event.error);
    };

    recognition.onend = () => {
      if (shouldRunRef.current) {
        try {
          recognition.start();
        } catch {
          /* ignore */
        }
      } else {
        setConnected(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setConnected(true);
    setMode("browser-fallback");
    handlersRef.current.onStatus?.("browser-fallback-live");
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    disconnect();
    shouldRunRef.current = true;

    const response = await fetch("/api/transcription", { method: "POST" });
    const data = (await response.json()) as DeepgramTokenResponse & {
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error || "Failed to initialize transcription");
    }

    if (data.mode === "deepgram" && data.access_token) {
      try {
        await connectDeepgram(data.access_token);
        return;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Deepgram connect failed — falling back",
        );
      }
    }

    connectBrowserFallback();
  }, [connectBrowserFallback, connectDeepgram, disconnect]);

  const sendPcm = useCallback((chunk: Int16Array) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(chunk.buffer);
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  return {
    connected,
    mode,
    error,
    connect,
    disconnect,
    sendPcm,
  };
}
