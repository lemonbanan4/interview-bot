use tauri::{Emitter, Manager, WebviewWindow};

/// Toggle mouse event passthrough on the overlay window.
/// `enabled = true`  → clicks fall through to apps underneath (resting).
/// `enabled = false` → the HUD captures mouse input (interactive).
#[tauri::command]
fn set_click_through(window: WebviewWindow, enabled: bool) -> Result<(), String> {
  window
    .set_ignore_cursor_events(enabled)
    .map_err(|e| e.to_string())
}

fn toggle_overlay_visibility(app: &tauri::AppHandle) {
  let Some(window) = app.get_webview_window("main") else {
    return;
  };

  let visible = window.is_visible().unwrap_or(true);
  if visible {
    let _ = window.hide();
    let _ = app.emit("overlay-visibility", false);
  } else {
    let _ = window.show();
    let _ = window.set_focus();
    // Re-assert click-through after show so shares stay safe.
    let _ = window.set_ignore_cursor_events(true);
    let _ = app.emit("overlay-visibility", true);
  }
}

fn open_settings(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.set_focus();
    let _ = window.set_ignore_cursor_events(false);
  }
  let _ = app.emit("navigate-to-settings", ());
  let _ = app.emit("overlay-visibility", true);
}

#[cfg(desktop)]
fn setup_system_tray(app: &tauri::App) -> tauri::Result<()> {
  use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem};
  use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

  let toggle = MenuItem::with_id(app, "toggle", "Toggle HUD Visibility", true, None::<&str>)?;
  let settings = MenuItem::with_id(app, "settings", "Open Settings", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Quit AI Copilot", true, None::<&str>)?;
  let separator = PredefinedMenuItem::separator(app)?;

  let menu = MenuBuilder::new(app)
    .item(&toggle)
    .item(&settings)
    .item(&separator)
    .item(&quit)
    .build()?;

  // Prefer the config-created tray (`app.trayIcon`); otherwise build one.
  if let Some(tray) = app.tray_by_id("main") {
    tray.set_menu(Some(menu))?;
  } else {
    let icon = app
      .default_window_icon()
      .cloned()
      .expect("missing default window icon for tray");

    let _tray = TrayIconBuilder::with_id("main")
      .icon(icon)
      .icon_as_template(true)
      .tooltip("Signal — Interview Copilot")
      .menu(&menu)
      .show_menu_on_left_click(true)
      .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click {
          button: MouseButton::Left,
          button_state: MouseButtonState::Up,
          ..
        } = event
        {
          toggle_overlay_visibility(tray.app_handle());
        }
      })
      .build(app)?;
  }

  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![set_click_through]);

  // Persist size/position across launches; shows the window after restore
  // when tauri.conf.json starts with `"visible": false` (avoids flash).
  #[cfg(desktop)]
  {
    use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};

    builder = builder
      .plugin(
        WindowStateBuilder::new()
          .with_state_flags(StateFlags::POSITION | StateFlags::SIZE | StateFlags::VISIBLE)
          .build(),
      )
      .plugin(tauri_plugin_process::init())
      .plugin(tauri_plugin_updater::Builder::new().build());
  }

  builder
    .on_menu_event(|app, event| match event.id().as_ref() {
      "toggle" => toggle_overlay_visibility(&app),
      "settings" => open_settings(&app),
      "quit" => app.exit(0),
      _ => {}
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(desktop)]
      {
        use tauri_plugin_global_shortcut::{Builder as ShortcutBuilder, ShortcutState};

        // Cmd+Shift+H (macOS) / Ctrl+Shift+H (Windows/Linux)
        app.handle().plugin(
          ShortcutBuilder::new()
            .with_shortcuts(["CommandOrControl+Shift+H"])?
            .with_handler(|app, _shortcut, event| {
              if event.state == ShortcutState::Pressed {
                toggle_overlay_visibility(app);
              }
            })
            .build(),
        )?;

        setup_system_tray(app)?;
      }

      if let Some(window) = app.get_webview_window("main") {
        // Resting = click-through so screen shares / Zoom stay usable.
        // Position/size come from window-state (do not override here).
        let _ = window.set_ignore_cursor_events(true);
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
