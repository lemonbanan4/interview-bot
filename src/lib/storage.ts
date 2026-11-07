import type { InterviewProfile, InterviewSession } from "./types";
import { emptyProfile } from "./types";

const PROFILE_KEY = "interview-bot:profile";
const SESSIONS_KEY = "interview-bot:sessions";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadProfile(): InterviewProfile {
  if (typeof window === "undefined") return emptyProfile();
  return safeParse(localStorage.getItem(PROFILE_KEY), emptyProfile());
}

export function saveProfile(profile: InterviewProfile): void {
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({ ...profile, updatedAt: Date.now() }),
  );
}

export function loadSessions(): InterviewSession[] {
  if (typeof window === "undefined") return [];
  const sessions = safeParse<InterviewSession[]>(
    localStorage.getItem(SESSIONS_KEY),
    [],
  );
  return sessions.sort((a, b) => b.createdAt - a.createdAt);
}

export function loadSession(id: string): InterviewSession | null {
  return loadSessions().find((s) => s.id === id) ?? null;
}

export function upsertSession(session: InterviewSession): void {
  const sessions = loadSessions();
  const index = sessions.findIndex((s) => s.id === session.id);
  if (index >= 0) sessions[index] = session;
  else sessions.unshift(session);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function deleteSession(id: string): void {
  const sessions = loadSessions().filter((s) => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function createSessionId(): string {
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
