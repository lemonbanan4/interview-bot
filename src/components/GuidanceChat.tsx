"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InterviewProfile } from "@/lib/types";
import { loadProfile } from "@/lib/storage";

export type GuidanceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type GuidanceChatProps = {
  /** Controlled open state (optional) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  profile?: InterviewProfile | null;
  /** Full-page mentor (no floating FAB / drawer). */
  variant?: "drawer" | "page";
};

const glass =
  "bg-slate-950/80 backdrop-blur-xl border border-slate-800 transition-all duration-300";

/**
 * Sleek side-panel AI mentor for pre-interview mock Q&A and prep advice.
 */
export function GuidanceChat({
  open: controlledOpen,
  onOpenChange,
  profile: profileProp,
  variant = "drawer",
}: GuidanceChatProps) {
  const [internalOpen, setInternalOpen] = useState(variant === "page");
  const open = variant === "page" ? true : (controlledOpen ?? internalOpen);
  const setOpen = onOpenChange ?? setInternalOpen;

  const [profile, setProfile] = useState<InterviewProfile | null>(
    profileProp ?? null,
  );
  const [messages, setMessages] = useState<GuidanceMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "I'm your Signal Mentor. Ask for a mock round, drill a weak spot, or paste an answer for critique — I'll tailor it to your resume and target role.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profileProp) setProfile(profileProp);
    else setProfile(loadProfile());
  }, [profileProp, open]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, streaming]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: GuidanceMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
    };
    const history = [...messages.filter((m) => m.id !== "welcome"), userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    setError(null);

    const assistantId = `a_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const current = profile ?? loadProfile();
      const response = await fetch("/api/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          resumeText: current.resumeText,
          jobTitle: current.jobTitle,
          company: current.company,
          jobDescription: current.jobDescription,
          aiPersona: current.aiPersona || "concise",
        }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Mentor request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assembled = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assembled += decoder.decode(value, { stream: true });
        const snapshot = assembled;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: snapshot } : m,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mentor failed");
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setStreaming(false);
    }
  }, [input, messages, profile, streaming]);

  const chatBody = (
    <>
      <div
        ref={scrollerRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed transition ${
              message.role === "user"
                ? "ml-auto border border-teal-500/25 bg-teal-500/15 text-teal-50"
                : "mr-auto border border-slate-800 bg-slate-900/80 text-slate-200"
            }`}
          >
            <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {message.role === "user" ? "You" : "Mentor"}
            </p>
            <p className="whitespace-pre-wrap">{message.content || "…"}</p>
          </div>
        ))}
        {streaming ? (
          <p className="animate-pulse text-xs text-teal-400/80">Thinking…</p>
        ) : null}
        {error ? (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        ) : null}
      </div>

      <div className="border-t border-slate-800 p-4">
        <div className="mb-2 flex flex-wrap gap-2">
          {["Run a mock question", "Critique my intro", "Map resume → JD"].map(
            (chip) => (
              <button
                key={chip}
                type="button"
                disabled={streaming}
                onClick={() => setInput(chip)}
                className="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs text-slate-300 transition hover:border-teal-500/40 hover:text-teal-200 disabled:opacity-40"
              >
                {chip}
              </button>
            ),
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your mentor…"
            className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-teal-500/50"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-xl bg-teal-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </>
  );

  if (variant === "page") {
    return (
      <div
        className={`flex min-h-[70vh] flex-col overflow-hidden rounded-2xl ${glass}`}
      >
        <header className="border-b border-slate-800 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400">
            Pre-interview
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-lg text-slate-100">
            Guidance chatbot
          </h2>
        </header>
        {chatBody}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-40 rounded-full px-4 py-3 text-sm font-semibold text-teal-300 shadow-lg shadow-teal-950/40 ${glass} hover:border-teal-500/40 hover:text-teal-200`}
      >
        AI Mentor
      </button>

      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col ${glass} shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-400">
              Pre-interview
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-lg text-slate-100">
              Guidance chatbot
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 transition hover:bg-slate-900 hover:text-slate-100"
          >
            Close
          </button>
        </header>
        {chatBody}
      </aside>
    </>
  );
}
