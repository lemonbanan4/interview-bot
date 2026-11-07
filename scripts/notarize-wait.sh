#!/usr/bin/env bash
# Poll Apple notarization and staple the local .app when Accepted.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

eval "$("${ROOT}/scripts/secrets-keychain.sh" export 2>/dev/null || true)"
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

APPLE_ID="${APPLE_ID%\"}"; APPLE_ID="${APPLE_ID#\"}"
APPLE_PASSWORD="${APPLE_PASSWORD%\"}"; APPLE_PASSWORD="${APPLE_PASSWORD#\"}"
APPLE_TEAM_ID="${APPLE_TEAM_ID%\"}"; APPLE_TEAM_ID="${APPLE_TEAM_ID#\"}"

APP="${ROOT}/src-tauri/target/release/bundle/macos/Interview Copilot.app"
if [ ! -d "${APP}" ]; then
  echo "Missing app bundle: ${APP}"
  exit 1
fi

echo "Recent submissions:"
xcrun notarytool history --apple-id "${APPLE_ID}" --password "${APPLE_PASSWORD}" --team-id "${APPLE_TEAM_ID}"

IDS="$(xcrun notarytool history --apple-id "${APPLE_ID}" --password "${APPLE_PASSWORD}" --team-id "${APPLE_TEAM_ID}" 2>/dev/null | awk '/id:/{print $2}')"
if [ -z "${IDS}" ]; then
  echo "No submissions found"
  exit 1
fi

for id in ${IDS}; do
  echo "Waiting on ${id}…"
  if xcrun notarytool wait "${id}" --apple-id "${APPLE_ID}" --password "${APPLE_PASSWORD}" --team-id "${APPLE_TEAM_ID}"; then
    info="$(xcrun notarytool info "${id}" --apple-id "${APPLE_ID}" --password "${APPLE_PASSWORD}" --team-id "${APPLE_TEAM_ID}")"
    echo "${info}"
    if echo "${info}" | grep -q 'status: Accepted'; then
      echo "Stapling ${APP}"
      xcrun stapler staple "${APP}"
      xcrun stapler validate "${APP}"
      echo "Notarized + stapled."
      exit 0
    fi
  fi
done

echo "No Accepted submission yet."
exit 2
