"use client";

import { useCallback, useState } from "react";
import { isTauriDesktop } from "@/lib/tauriDesktop";

/**
 * Check / install desktop updates via `@tauri-apps/plugin-updater` (Tauri v2).
 * No-ops in the browser.
 */
export function useAppUpdater() {
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const checkForAppUpdates = useCallback(async () => {
    if (!isTauriDesktop()) {
      setStatus("Updates are only available in the desktop app.");
      return;
    }

    setUpdating(true);
    setStatus("Checking for updates…");

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");

      const update = await check();

      if (!update) {
        setStatus("You are running the latest version.");
        return;
      }

      const confirmed = window.confirm(
        `A new version (${update.version}) is available.\n\n${
          update.body || "Bug fixes and improvements."
        }\n\nUpdate now?`,
      );

      if (!confirmed) {
        setStatus("Update postponed.");
        return;
      }

      setStatus(`Downloading ${update.version}…`);
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          setStatus(
            `Downloading ${event.data.contentLength ?? "?"} bytes…`,
          );
        } else if (event.event === "Finished") {
          setStatus("Installing…");
        }
      });

      setStatus("Restarting…");
      await relaunch();
    } catch (error) {
      console.error("Failed to check for updates:", error);
      setStatus(
        error instanceof Error
          ? error.message
          : "Failed to check for updates.",
      );
    } finally {
      setUpdating(false);
    }
  }, []);

  return { checkForAppUpdates, updating, status };
}
