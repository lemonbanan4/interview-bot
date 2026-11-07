/**
 * Prepares a minimal static shell for Tauri bundling.
 * The desktop companion loads the Next.js /hud surface over HTTP
 * (dev server or deployed app) — full `output: "export"` would break APIs.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src-tauri", "ui-dist");
const appUrl = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const hudUrl = `${appUrl}/hud`;

mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Signal HUD</title>
    <style>
      html, body {
        margin: 0;
        height: 100%;
        background: transparent;
        color: #e2e8f0;
        font: 14px/1.4 system-ui, sans-serif;
        display: grid;
        place-items: center;
      }
    </style>
    <script>
      // Prefer the live Next app (APIs, auth, streaming). Fallback is this shell.
      location.replace(${JSON.stringify(hudUrl)});
    </script>
  </head>
  <body>
    <p>Loading Signal Stealth HUD…</p>
    <p><a href=${JSON.stringify(hudUrl)}>Open HUD</a></p>
  </body>
</html>
`,
  "utf8",
);

console.log(`Prepared Tauri UI dist → ${outDir}`);
console.log(`HUD target → ${hudUrl}`);
