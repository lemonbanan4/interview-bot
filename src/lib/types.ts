export type TranscriptEntry = {
  id: string;
  role: "interviewer" | "candidate" | "system";
  text: string;
  timestamp: number;
};

export type TalkingPoint = {
  id: string;
  title: string;
  bullets: string[];
  createdAt: number;
};

export type VoiceSampleMeta = {
  fileName: string;
  mimeType: string;
  durationSec: number;
  createdAt: number;
  byteLength: number;
};

export type AiPersona =
  | "concise"
  | "storyteller"
  | "technical"
  | "executive";

export type InterviewProfile = {
  resumeText: string;
  resumeFileName?: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  /** Coaching voice / answer style for the live HUD + mentor. */
  aiPersona?: AiPersona;
  /** User acknowledged window/tab-only screen share rule. */
  screenShareSafetyAck?: boolean;
  voiceSample?: VoiceSampleMeta;
  updatedAt: number;
};

export type InterviewReviewMetrics = {
  technicalAccuracy: number;
  communicationClarity: number;
  pacingAndConfidence: number;
};

export type InterviewReview = {
  summary: string;
  score: number;
  strengths: string[];
  improvements: string[];
  highlights: string[];
  metrics?: InterviewReviewMetrics;
};

export type InterviewSession = {
  id: string;
  createdAt: number;
  endedAt?: number;
  jobTitle: string;
  company: string;
  transcript: TranscriptEntry[];
  talkingPoints: TalkingPoint[];
  review?: InterviewReview;
  status: "live" | "completed";
};

export const emptyProfile = (): InterviewProfile => ({
  resumeText: "",
  jobTitle: "",
  company: "",
  jobDescription: "",
  aiPersona: "concise",
  screenShareSafetyAck: false,
  updatedAt: 0,
});

export const AI_PERSONA_OPTIONS: Array<{
  id: AiPersona;
  label: string;
  blurb: string;
}> = [
  {
    id: "concise",
    label: "Concise",
    blurb: "Tight bullets, 20–40 second answers, no fluff.",
  },
  {
    id: "storyteller",
    label: "Storyteller",
    blurb: "STAR-shaped narratives with stakes and outcomes.",
  },
  {
    id: "technical",
    label: "Technical",
    blurb: "Systems, tradeoffs, and depth-first explanations.",
  },
  {
    id: "executive",
    label: "Executive",
    blurb: "Strategy, leadership leverage, and business impact.",
  },
];
