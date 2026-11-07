// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Interview Copilot desktop overlay.
//!
//! - `set_click_through` — mouse passthrough (see `lib.rs`)
//! - Global hotkey **Cmd/Ctrl+Shift+H** — show / hide the HUD overlay
//! - System tray — Toggle HUD / Open Settings / Quit
//! - `tauri-plugin-window-state` — restore size/position; starts `visible: false`
//! - `tauri-plugin-updater` — signed auto-updates (pubkey in tauri.conf.json)

fn main() {
  app_lib::run();
}
