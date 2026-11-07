# GitHub Actions release secrets

Used by `.github/workflows/release.yml` on `v*` tags. Set them under  
**Repo → Settings → Secrets and variables → Actions**.

`GITHUB_TOKEN` is provided automatically — do not create it.

---

## 1. Tauri updater & cryptographic signing

| Secret | Required | What it is |
| --- | --- | --- |
| `TAURI_PRIVATE_KEY` | Yes | Raw contents of the Ed25519 private key from `tauri signer generate` (e.g. `~/.tauri/copilot-key.key`) |
| `TAURI_KEY_PASSWORD` | Optional | Passphrase for that key, if you set one |

The workflow maps these to Tauri’s `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` env vars so updater `.sig` files are produced and trusted by the client pubkey in `tauri.conf.json`.

```bash
# Generate (once)
npx tauri signer generate -w ~/.tauri/copilot-key.key

# Upload private key contents (never commit the file)
gh secret set TAURI_PRIVATE_KEY < ~/.tauri/copilot-key.key
# gh secret set TAURI_KEY_PASSWORD  # only if the key is encrypted
```

Public key must already match `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`.

---

## 2. Apple code-signing (macOS)

| Secret | Required | What it is |
| --- | --- | --- |
| `APPLE_CERTIFICATE` | Yes (macOS Gatekeeper) | Developer ID Application `.p12`, Base64-encoded |
| `APPLE_CERTIFICATE_PASSWORD` | Yes | Password used when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Yes | Exact identity string, e.g. `Developer ID Application: CogCore LLC (HT252YCTSN)` |

```bash
security find-identity -v -p codesigning
# Export .p12 from Keychain Access, then:
base64 -i ~/.tauri/developer-id-application.p12 | pbcopy   # macOS
# or: openssl base64 -A -in cert.p12 -out cert.p12.base64

gh secret set APPLE_CERTIFICATE < ~/.tauri/developer-id-application.p12.base64
gh secret set APPLE_CERTIFICATE_PASSWORD   # paste the .p12 password
gh secret set APPLE_SIGNING_IDENTITY -b"Developer ID Application: CogCore LLC (HT252YCTSN)"
```

---

## 3. Apple notarization (macOS)

| Secret | Required | What it is |
| --- | --- | --- |
| `APPLE_ID` | Yes | Apple Developer account email (e.g. `developer@orbitroutine.com`) |
| `APPLE_PASSWORD` | Yes | **App-specific password** from [appleid.apple.com](https://appleid.apple.com) — not your login password |
| `APPLE_TEAM_ID` | Yes | 10-character Team ID (e.g. `HT252YCTSN`) |

```bash
gh secret set APPLE_ID -b"developer@orbitroutine.com"
gh secret set APPLE_PASSWORD   # paste app-specific password interactively
gh secret set APPLE_TEAM_ID -b"HT252YCTSN"
```

---

## 4. Windows (optional)

| Secret | What it is |
| --- | --- |
| `WINDOWS_CERTIFICATE` | Base64 `.pfx` |
| `WINDOWS_CERTIFICATE_PASSWORD` | `.pfx` export password |

---

## Local secure storage (macOS Keychain)

Sensitive values are stored in Keychain service `interview-bot.secrets` (not plaintext in `.env`):

```bash
# One-time: copy current .env / ~/.tauri secrets into Keychain and scrub .env
./scripts/secrets-keychain.sh store-from-env

# Before local signed builds / notarization
eval "$(./scripts/secrets-keychain.sh export)"
npm run tauri:build:dmg

# Push Keychain → GitHub Actions secrets
./scripts/secrets-keychain.sh sync-github
```

## Helper script (interactive)

```bash
./scripts/set-github-release-secrets.sh
```

Loads local `~/.tauri/*` files and prompts for passwords / Apple ID fields.

## Trigger a release

```bash
git tag v0.1.1
git push origin v0.1.1
```
