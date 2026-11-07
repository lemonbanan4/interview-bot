"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isTauriDesktop } from "@/lib/tauriDesktop";

/**
 * Listens for tray-menu events from the Tauri backend and routes
 * into the settings view. No-ops outside the desktop webview.
 */
export function useTrayNavigation() {
  const router = useRouter();

  useEffect(() => {
    if (!isTauriDesktop()) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    async function setupListener() {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        if (cancelled) return;
        unlisten = await listen("navigate-to-settings", () => {
          router.push("/dashboard/settings");
        });
      } catch {
        // Not running inside a Tauri webview.
      }
    }

    void setupListener();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [router]);
}
