export type LiveHintPayload = {
  suggestion: string;
  liveStatus: string;
  listening: boolean;
  updatedAt: number;
};

const LIVE_HINT_KEY = "interview-copilot:live-hint";
const CHANNEL = "interview-copilot-live-hint";

const emptyHint = (): LiveHintPayload => ({
  suggestion: "",
  liveStatus: "standby",
  listening: false,
  updatedAt: 0,
});

export function publishLiveHint(
  payload: Omit<LiveHintPayload, "updatedAt">,
): void {
  if (typeof window === "undefined") return;

  const next: LiveHintPayload = { ...payload, updatedAt: Date.now() };
  localStorage.setItem(LIVE_HINT_KEY, JSON.stringify(next));

  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(next);
    channel.close();
  } catch {
    // BroadcastChannel unavailable — storage event still covers other tabs.
  }
}

export function readLiveHint(): LiveHintPayload {
  if (typeof window === "undefined") return emptyHint();
  try {
    const raw = localStorage.getItem(LIVE_HINT_KEY);
    if (!raw) return emptyHint();
    return { ...emptyHint(), ...JSON.parse(raw) } as LiveHintPayload;
  } catch {
    return emptyHint();
  }
}

export function subscribeLiveHint(
  onHint: (payload: LiveHintPayload) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  onHint(readLiveHint());

  const onStorage = (event: StorageEvent) => {
    if (event.key !== LIVE_HINT_KEY || !event.newValue) return;
    try {
      onHint({ ...emptyHint(), ...JSON.parse(event.newValue) });
    } catch {
      // ignore malformed payloads
    }
  };

  window.addEventListener("storage", onStorage);

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<LiveHintPayload>) => {
      if (event.data) onHint(event.data);
    };
  } catch {
    channel = null;
  }

  const poll = window.setInterval(() => onHint(readLiveHint()), 1200);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.clearInterval(poll);
    channel?.close();
  };
}
