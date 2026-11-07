#!/usr/bin/env bash
# Create/update a GitHub Release from local Tauri artifacts and refresh updater manifest URLs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

VERSION="${1:-$(node -p "require('./package.json').version")}"
TAG="v${VERSION}"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

DMG="${ROOT}/src-tauri/target/release/bundle/dmg/Interview Copilot_${VERSION}_aarch64.dmg"
TARBALL="${ROOT}/src-tauri/target/release/bundle/macos/Interview Copilot.app.tar.gz"
SIG="${TARBALL}.sig"

for f in "${DMG}" "${TARBALL}" "${SIG}"; do
  if [ ! -f "${f}" ]; then
    echo "Missing artifact: ${f}"
    echo "Build first: eval \$(./scripts/secrets-keychain.sh export) && npm run tauri:build:dmg"
    exit 1
  fi
done

# Ensure tag exists
if ! git rev-parse "${TAG}" >/dev/null 2>&1; then
  git tag "${TAG}"
  git push origin "${TAG}"
else
  git push origin "${TAG}" 2>/dev/null || true
fi

if gh release view "${TAG}" >/dev/null 2>&1; then
  echo "Updating existing release ${TAG}"
else
  gh release create "${TAG}" \
    --title "AI Interview Copilot ${TAG}" \
    --notes "Desktop companion release ${TAG} (macOS Apple Silicon)."
fi

gh release upload "${TAG}" \
  "${DMG}" \
  "${TARBALL}" \
  "${SIG}" \
  --clobber

# GitHub CDN URLs for updater
BASE="https://github.com/${REPO}/releases/download/${TAG}"
# Note: spaces in filenames are URL-encoded by GitHub as %20
TARBALL_NAME="$(basename "${TARBALL}")"
SIG_NAME="$(basename "${SIG}")"
TARBALL_URL="${BASE}/$(python3 -c "import urllib.parse; print(urllib.parse.quote('''${TARBALL_NAME}'''))")"

SIG_CONTENTS="$(cat "${SIG}")"
python3 - <<PY
import json
from pathlib import Path
from datetime import datetime, timezone
path = Path("src-tauri/updater/latest.json")
data = json.loads(path.read_text())
data["version"] = "${VERSION}"
data["pub_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
data.setdefault("platforms", {})
data["platforms"]["darwin-aarch64"] = {
  "url": "${TARBALL_URL}",
  "signature": """${SIG_CONTENTS}""".strip(),
}
path.write_text(json.dumps(data, indent=2) + "\n")
print(f"Updated {path} → darwin-aarch64 @ ${TARBALL_URL}")
PY

echo "Release: https://github.com/${REPO}/releases/tag/${TAG}"
echo "Remember to commit/push updated src-tauri/updater/latest.json"
