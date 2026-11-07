# Desktop release (Tauri)

## Local builds

### macOS (`.app` + `.dmg`)

```bash
export TAURI_SIGNING_PRIVATE_KEY="$HOME/.tauri/copilot-key.key"
# optional password if the key was generated with one:
# export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="…"

npm run tauri:build:dmg
```

Artifacts:

- `src-tauri/target/release/bundle/dmg/*.dmg`
- matching `.sig` updater signatures (when the private key is set)

### Windows (`.msi` + NSIS setup)

On a Windows machine with Node + Rust:

```bash
npm run tauri:build:msi
# or: npm run tauri build
```

Artifacts under `src-tauri/target/release/bundle/msi/` and `nsis/`.

## Code signing

### macOS (Gatekeeper + notarization)

You need a **Developer ID Application** certificate (not “Apple Development” / “Apple Distribution”). Create it in [Apple Developer → Certificates](https://developer.apple.com/account/resources/certificates/list), then install it in Keychain.

```bash
security find-identity -v -p codesigning
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
npm run tauri:build:dmg
```

Or set `bundle.macOS.signingIdentity` in `src-tauri/tauri.conf.json`.

### Windows

Acquire an EV/Standard code-signing `.pfx`, then:

```bash
export WINDOWS_CERTIFICATE="/path/to/certificate.pfx"
export WINDOWS_CERTIFICATE_PASSWORD="…"
# optional: set bundle.windows.certificateThumbprint in tauri.conf.json
npm run tauri:build:msi
```

## CI (GitHub Actions)

Push a version tag to trigger `.github/workflows/release.yml`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Full secret reference + upload helper: [github-release-secrets.md](./github-release-secrets.md)

| Secret | Purpose |
| --- | --- |
| `TAURI_PRIVATE_KEY` | Updater Ed25519 private key (maps → `TAURI_SIGNING_PRIVATE_KEY`) |
| `TAURI_KEY_PASSWORD` | Optional key passphrase |
| `APPLE_CERTIFICATE` | Base64 Developer ID Application `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` password |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: CogCore LLC (HT252YCTSN)` |
| `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` | Notarization (app-specific password) |
| `WINDOWS_CERTIFICATE` / `WINDOWS_CERTIFICATE_PASSWORD` | Optional Windows `.pfx` |
| `GITHUB_TOKEN` | Automatic — used by `tauri-action` to publish release assets |

```bash
./scripts/set-github-release-secrets.sh
```

## Updater manifest (Next.js)

Tauri polls:

`GET /api/releases/latest?target={{target}}&arch={{arch}}&current_version={{current_version}}`

- **204** — up to date or unsupported platform / missing signature
- **200** — single-platform JSON: `{ version, notes, pub_date, url, signature }`

Source of truth: `src-tauri/updater/latest.json` (or `DESKTOP_RELEASE_JSON` env).

After each signed build, paste the `.sig` file contents into the matching platform entry and upload the `.tar.gz` / `.nsis.zip` to your release CDN (`url`).

```bash
# Smoke-test locally
curl -i "http://localhost:3000/api/releases/latest?target=darwin&arch=aarch64&current_version=0.0.1"
```
