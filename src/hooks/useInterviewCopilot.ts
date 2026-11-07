"use client";

import { useCompletion } from "@ai-sdk/react";
import { useCallback, useMemo, useState } from "react";
import type { InterviewProfile, TalkingPoint } from "@/lib/types";

type CopilotBody = {
  resumeContext: string;
  resumeText: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  recentTranscript: string;
};

/**
 * Wraps Vercel AI SDK `useCompletion` for token-streaming talking points.
 * Call `processInterviewerInput(text)` whenever STT (or typed input) yields a question.
 */
export function useInterviewCopilot(profile: InterviewProfile) {
  const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);
  const [savedPoints, setSavedPoints] = useState<TalkingPoint[]>([]);

  const body: CopilotBody = useMemo(
    () => ({
      resumeContext: profile.resumeText,
      resumeText: profile.resumeText,
      jobTitle: profile.jobTitle,
      company: profile.company,
      jobDescription: profile.jobDescription,
      recentTranscript: transcriptHistory.slice(-8).join("\n"),
    }),
    [profile, transcriptHistory],
  );

  const { completion, complete, isLoading, error, stop, setCompletion } =
    useCompletion({
      api: "/api/copilot",
      streamProtocol: "text",
      body,
      onFinish: (_prompt, finalCompletion) => {
        const point = parseTalkingPoint(finalCompletion);
        if (point) {
          setSavedPoints((prev) => [point, ...prev].slice(0, 8));
        }
      },
    });

  const processInterviewerInput = useCallback(
    async (newText: string) => {
      const trimmed = newText.trim();
      if (!trimmed) return;
      setTranscriptHistory((prev) => [...prev, trimmed]);
      setCompletion("");
      await complete(trimmed, {
        body: {
          ...body,
          recentTranscript: [...transcriptHistory, trimmed].slice(-8).join("\n"),
        },
      });
    },
    [body, complete, setCompletion, transcriptHistory],
  );

  return {
    transcriptHistory,
    setTranscriptHistory,
    aiSuggestions: completion,
    savedPoints,
    isLoading,
    error,
    processInterviewerInput,
    stop,
  };
}

function parseTalkingPoint(text: string): TalkingPoint | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const bullets = lines
    .filter((line) => /^[-•*]/.test(line))
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  const title =
    lines.find((line) => !/^[-•*]/.test(line)) ||
    bullets[0]?.slice(0, 40) ||
    "Talking points";

  return {
    id: `p_${Date.now()}`,
    title: title.replace(/^#+\s*/, "").slice(0, 80),
    bullets: bullets.length ? bullets.slice(0, 5) : lines.slice(1, 5),
    createdAt: Date.now(),
  };
}
