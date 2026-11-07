/** Detect the Tauri webview (vs plain browser). */
export function isTauriDesktop(): boolean {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

/**
 * Toggle mouse passthrough via the Rust `set_click_through` command.
 * Falls back to the JS window API when invoke is unavailable.
 */
export async function setClickThrough(enabled: boolean): Promise<void> {
  if (!isTauriDesktop()) return;

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_click_through", { enabled });
    return;
  } catch {
    // fall through to JS API
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setIgnoreCursorEvents(enabled);
  } catch {
    // Not running inside a capable Tauri window.
  }
}
