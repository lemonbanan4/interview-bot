import { NextResponse } from "next/server";
import {
  grantDeepgramToken,
  type DeepgramTokenResponse,
} from "@/lib/deepgram";

/**
 * Issues a short-lived Deepgram access token for browser WebSocket STT.
 * Falls back to browser-mode so the HUD still works without DEEPGRAM_API_KEY.
 */
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    const body: DeepgramTokenResponse = {
      access_token: "",
      expires_in: 0,
      mode: "browser-fallback",
    };
    return NextResponse.json(body);
  }

  try {
    const token = await grantDeepgramToken(apiKey);
    const body: DeepgramTokenResponse = {
      access_token: token.access_token,
      expires_in: token.expires_in,
      mode: "deepgram",
    };
    return NextResponse.json(body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to grant Deepgram token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
