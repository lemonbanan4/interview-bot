/** Deepgram STT — server prerecorded + browser live helpers. */

export const DEEPGRAM_WS_URL =
  "wss://api.deepgram.com/v1/listen?" +
  new URLSearchParams({
    model: "nova-2",
    language: "en-US",
    punctuate: "true",
    interim_results: "true",
    smart_format: "true",
    encoding: "linear16",
    sample_rate: "16000",
    channels: "1",
  }).toString();

export type DeepgramTokenResponse = {
  access_token: string;
  expires_in: number;
  mode: "deepgram" | "browser-fallback";
};

export async function grantDeepgramToken(
  apiKey: string,
): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: 60 }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Deepgram token grant failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
}

/** Transcribe raw linear16 PCM (16 kHz mono) via Deepgram prerecorded API. */
export async function transcribePcm(
  apiKey: string,
  pcm: Buffer,
): Promise<string> {
  const url =
    "https://api.deepgram.com/v1/listen?" +
    new URLSearchParams({
      model: "nova-2",
      language: "en-US",
      punctuate: "true",
      smart_format: "true",
      encoding: "linear16",
      sample_rate: "16000",
      channels: "1",
    }).toString();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "audio/raw",
    },
    body: new Uint8Array(pcm),
  });

  if (!response.ok) {
    throw new Error(
      `Deepgram STT failed (${response.status}): ${await response.text()}`,
    );
  }

  const data = (await response.json()) as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{ transcript?: string }>;
      }>;
    };
  };

  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || "";
}

export function parseDeepgramMessage(raw: string): {
  transcript: string;
  isFinal: boolean;
} | null {
  try {
    const data = JSON.parse(raw) as {
      type?: string;
      channel?: {
        alternatives?: Array<{ transcript?: string }>;
      };
      is_final?: boolean;
      speech_final?: boolean;
    };

    if (data.type && data.type !== "Results") return null;
    const transcript = data.channel?.alternatives?.[0]?.transcript?.trim() || "";
    if (!transcript) return null;
    return {
      transcript,
      isFinal: Boolean(data.is_final || data.speech_final),
    };
  } catch {
    return null;
  }
}
