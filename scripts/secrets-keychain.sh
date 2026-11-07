#!/usr/bin/env bash
# Store / load interview-bot secrets from the macOS Keychain.
#
#   ./scripts/secrets-keychain.sh store-from-env
#   eval "$(./scripts/secrets-keychain.sh export)"
#   ./scripts/secrets-keychain.sh get APPLE_PASSWORD
#   ./scripts/secrets-keychain.sh set APPLE_PASSWORD
#   ./scripts/secrets-keychain.sh list
#   ./scripts/secrets-keychain.sh sync-github
set -euo pipefail

SERVICE="interview-bot.secrets"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"
TAURI_DIR="${HOME}/.tauri"

kc_set() {
  local account="$1"
  local value="$2"
  if [ -z "${value}" ]; then
    echo "skip empty: ${account}" >&2
    return 0
  fi
  security add-generic-password -U \
    -s "${SERVICE}" \
    -a "${account}" \
    -w "${value}" \
    >/dev/null
  echo "stored ${account}"
}

kc_get() {
  local account="$1"
  security find-generic-password -s "${SERVICE}" -a "${account}" -w 2>/dev/null
}

read_env() {
  local key="$1"
  [ -f "${ENV_FILE}" ] || return 0
  local line
  line="$(grep -E "^${key}=" "${ENV_FILE}" | tail -1 || true)"
  [ -n "${line}" ] || return 0
  local val="${line#*=}"
  val="${val%\"}"
  val="${val#\"}"
  val="${val%\'}"
  val="${val#\'}"
  printf '%s' "${val}"
}

cmd="${1:-}"
case "${cmd}" in
  store-from-env)
    echo "Locking down ~/.tauri and .env permissions…"
    mkdir -p "${TAURI_DIR}"
    chmod 700 "${TAURI_DIR}" 2>/dev/null || true
    chmod 600 "${TAURI_DIR}"/* 2>/dev/null || true
    [ -f "${ENV_FILE}" ] && chmod 600 "${ENV_FILE}"

    kc_set "APPLE_ID" "$(read_env APPLE_ID)"
    kc_set "APPLE_PASSWORD" "$(read_env APPLE_PASSWORD)"
    kc_set "APPLE_TEAM_ID" "$(read_env APPLE_TEAM_ID)"
    kc_set "APPLE_SIGNING_IDENTITY" "$(read_env APPLE_SIGNING_IDENTITY)"
    kc_set "APPLE_CERTIFICATE_PASSWORD" "${APPLE_CERTIFICATE_PASSWORD:-signal-dev-id}"
    kc_set "AUTH_SECRET" "$(read_env AUTH_SECRET)"
    kc_set "DATABASE_URL" "$(read_env DATABASE_URL)"

    if [ -f "${TAURI_DIR}/copilot-key.key" ]; then
      kc_set "TAURI_PRIVATE_KEY" "$(cat "${TAURI_DIR}/copilot-key.key")"
      chmod 600 "${TAURI_DIR}/copilot-key.key"
    fi
    if [ -f "${TAURI_DIR}/developer-id-application.p12.base64" ]; then
      kc_set "APPLE_CERTIFICATE" "$(cat "${TAURI_DIR}/developer-id-application.p12.base64")"
      chmod 600 "${TAURI_DIR}/developer-id-application.p12" \
        "${TAURI_DIR}/developer-id-application.p12.base64" \
        "${TAURI_DIR}/developer-id-application.key" 2>/dev/null || true
    fi

    if [ -f "${ENV_FILE}" ]; then
      python3 - "${ENV_FILE}" "${SERVICE}" <<'PY'
import sys
from pathlib import Path
path = Path(sys.argv[1])
service = sys.argv[2]
strip = {
    "APPLE_PASSWORD",
    "APPLE_CERTIFICATE_PASSWORD",
    "AUTH_SECRET",
    "TAURI_PRIVATE_KEY",
    "TAURI_SIGNING_PRIVATE_KEY",
    "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
    "TAURI_KEY_PASSWORD",
}
out = []
for line in path.read_text().splitlines():
    if not line.strip() or line.strip().startswith("#") or "=" not in line:
        out.append(line)
        continue
    k = line.split("=", 1)[0].strip()
    if k in strip:
        out.append(
            f"# {k} → macOS Keychain service={service} "
            f"(eval $(./scripts/secrets-keychain.sh export))"
        )
    else:
        out.append(line)
hint = "# Secrets: eval $(./scripts/secrets-keychain.sh export)"
if not any("secrets-keychain.sh export" in l for l in out):
    out.insert(0, hint)
path.write_text("\n".join(out).rstrip() + "\n")
print(f"hardened {path}")
PY
    fi
    echo "Done. Load with: eval \$(./scripts/secrets-keychain.sh export)"
    ;;

  export)
    for account in \
      APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID APPLE_SIGNING_IDENTITY \
      APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD \
      TAURI_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY_PASSWORD \
      AUTH_SECRET DATABASE_URL
    do
      if val="$(kc_get "${account}" 2>/dev/null)"; then
        if [ "${account}" = "TAURI_PRIVATE_KEY" ]; then
          printf "export TAURI_SIGNING_PRIVATE_KEY=%q\n" "${val}"
          printf "export TAURI_PRIVATE_KEY=%q\n" "${val}"
        else
          printf "export %s=%q\n" "${account}" "${val}"
        fi
      fi
    done
    ;;

  get)
    account="${2:?account name required}"
    kc_get "${account}"
    ;;

  set)
    account="${2:?account name required}"
    if [ -n "${3:-}" ]; then
      value="$3"
    else
      read -r -s -p "Value for ${account}: " value
      echo
    fi
    kc_set "${account}" "${value}"
    ;;

  list)
    for account in \
      APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID APPLE_SIGNING_IDENTITY \
      APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD TAURI_PRIVATE_KEY \
      AUTH_SECRET DATABASE_URL
    do
      if kc_get "${account}" >/dev/null 2>&1; then
        echo "${account}"
      fi
    done
    ;;

  sync-github)
    command -v gh >/dev/null || { echo "gh required"; exit 1; }
    for account in TAURI_PRIVATE_KEY APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD \
      APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID
    do
      if val="$(kc_get "${account}" 2>/dev/null)"; then
        printf '%s' "${val}" | gh secret set "${account}"
        echo "gh secret set ${account}"
      else
        echo "missing in keychain: ${account}"
      fi
    done
    ;;

  *)
    echo "Usage: $0 {store-from-env|export|get|set|list|sync-github}" >&2
    exit 1
    ;;
esac
