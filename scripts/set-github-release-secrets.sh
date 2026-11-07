#!/usr/bin/env bash
# Upload desktop release secrets to GitHub Actions.
# Requires: gh auth login, git remote origin
set -euo pipefail

if ! command -v gh >/dev/null; then
  echo "Install GitHub CLI: https://cli.github.com/"
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "No git remote 'origin'. Add a GitHub remote first."
  exit 1
fi

TAURI_DIR="${HOME}/.tauri"
KEY_FILE="${TAURI_DIR}/copilot-key.key"
P12_B64="${TAURI_DIR}/developer-id-application.p12.base64"
P12_FILE="${TAURI_DIR}/developer-id-application.p12"
IDENTITY_DEFAULT="Developer ID Application: CogCore LLC (HT252YCTSN)"
TEAM_DEFAULT="HT252YCTSN"
APPLE_ID_DEFAULT="developer@orbitroutine.com"

echo "==> Tauri updater private key"
if [ -f "${KEY_FILE}" ]; then
  gh secret set TAURI_PRIVATE_KEY < "${KEY_FILE}"
  echo "Set TAURI_PRIVATE_KEY from ${KEY_FILE}"
else
  echo "Missing ${KEY_FILE} — run: npx tauri signer generate -w ~/.tauri/copilot-key.key"
fi

read -r -s -p "TAURI_KEY_PASSWORD (Enter to skip): " TAURI_PASS
echo
if [ -n "${TAURI_PASS}" ]; then
  printf '%s' "${TAURI_PASS}" | gh secret set TAURI_KEY_PASSWORD
  echo "Set TAURI_KEY_PASSWORD"
fi

echo "==> Apple Developer ID certificate"
if [ ! -f "${P12_B64}" ] && [ -f "${P12_FILE}" ]; then
  openssl base64 -A -in "${P12_FILE}" -out "${P12_B64}"
fi
if [ -f "${P12_B64}" ]; then
  gh secret set APPLE_CERTIFICATE < "${P12_B64}"
  echo "Set APPLE_CERTIFICATE from ${P12_B64}"
else
  echo "Missing ${P12_B64} — export Developer ID .p12 and base64-encode it"
fi

read -r -s -p "APPLE_CERTIFICATE_PASSWORD (.p12 password): " CERT_PASS
echo
if [ -n "${CERT_PASS}" ]; then
  printf '%s' "${CERT_PASS}" | gh secret set APPLE_CERTIFICATE_PASSWORD
  echo "Set APPLE_CERTIFICATE_PASSWORD"
fi

read -r -p "APPLE_SIGNING_IDENTITY [${IDENTITY_DEFAULT}]: " IDENTITY
IDENTITY="${IDENTITY:-$IDENTITY_DEFAULT}"
gh secret set APPLE_SIGNING_IDENTITY -b"${IDENTITY}"
echo "Set APPLE_SIGNING_IDENTITY"

read -r -p "APPLE_ID [${APPLE_ID_DEFAULT}]: " APPLE_ID
APPLE_ID="${APPLE_ID:-$APPLE_ID_DEFAULT}"
gh secret set APPLE_ID -b"${APPLE_ID}"
echo "Set APPLE_ID"

read -r -s -p "APPLE_PASSWORD (app-specific password): " APPLE_PASS
echo
if [ -n "${APPLE_PASS}" ]; then
  printf '%s' "${APPLE_PASS}" | gh secret set APPLE_PASSWORD
  echo "Set APPLE_PASSWORD"
fi

read -r -p "APPLE_TEAM_ID [${TEAM_DEFAULT}]: " TEAM
TEAM="${TEAM:-$TEAM_DEFAULT}"
gh secret set APPLE_TEAM_ID -b"${TEAM}"
echo "Set APPLE_TEAM_ID"

echo
echo "Done. Current Actions secrets:"
gh secret list
