"use client";

import { useEffect, useState } from "react";
import { StealthHUD } from "@/components/copilot/StealthHud";
import { subscribeLiveHint, type LiveHintPayload } from "@/lib/liveHint";

/**
 * Transparent Tauri companion surface — only the StealthHUD panel is visible.
 * Hints stream from the browser session via localStorage / BroadcastChannel.
 */
export default function HudPage() {
  const [hint, setHint] = useState<LiveHintPayload>({
    suggestion: "",
    liveStatus: "standby",
    listening: false,
    updatedAt: 0,
  });
  const [opacity, setOpacity] = useState(0.82);

  useEffect(() => {
    document.documentElement.dataset.hud = "on";
    return () => {
      delete document.documentElement.dataset.hud;
    };
  }, []);

  useEffect(() => subscribeLiveHint(setHint), []);

  // Cmd/Ctrl+Shift+H visibility sync (settings routing is global via useTrayNavigation).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<boolean>("overlay-visibility", (event) => {
          document.documentElement.dataset.overlay = event.payload
            ? "shown"
            : "hidden";
        });
      } catch {
        // Browser / non-Tauri — ignore.
      }
    })();
    return () => unlisten?.();
  }, []);

  return (
    <StealthHUD
      companion
      opacity={opacity}
      onOpacityChange={setOpacity}
      liveStatus={hint.liveStatus}
      listening={hint.listening}
      suggestion={
        hint.suggestion ||
        "Waiting for talking points…  (⌘⇧H / Ctrl+Shift+H toggles HUD)"
      }
    />
  );
}
