# Signal Chrome Extension (Stealth HUD)

MV3 overlay for Google Meet / Zoom. Load this folder in Chrome — not the Next.js app root.

## Load unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `interview-bot/extension`
4. Join a Meet/Zoom call — the HUD appears top-right

## Files

| File | Role |
| --- | --- |
| `manifest.json` | MV3 config, content script matches, service worker |
| `background.js` | Service worker — forwards suggestions to the active tab |
| `content.js` | Shadow-DOM HUD injected into Meet/Zoom |
| `popup.html` / `popup.js` | Toolbar popup to push text into the HUD |

## Message flow

```
popup / Next.js bridge
  → { action: "PUSH_SUGGESTION_TO_TAB", suggestions }
  → background.js
  → { action: "UPDATE_AI_SUGGESTIONS", suggestions }
  → content.js HUD
```
