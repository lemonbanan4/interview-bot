#!/usr/bin/env bash
set -euo pipefail

CSR_KEY="${HOME}/.tauri/developer-id-application.key"
CSR_FILE="${HOME}/.tauri/developer-id-application.certSigningRequest"
P12_OUT="${HOME}/.tauri/developer-id-application.p12"
P12_PASS="${APPLE_CERTIFICATE_PASSWORD:-signal-dev-id}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

echo "Looking for Developer ID Application .cer in Downloads…"
CER=""
for i in $(seq 1 120); do
  # Prefer newest matching cer
  CER="$(ls -t "${HOME}/Downloads"/developerID_application*.cer "${HOME}/Downloads"/*Developer*ID*.cer 2>/dev/null | head -1 || true)"
  if [ -n "${CER}" ] && [ -f "${CER}" ]; then
    break
  fi
  sleep 1
done

if [ -z "${CER}" ] || [ ! -f "${CER}" ]; then
  echo "No .cer found. Download Developer ID Application from Apple Developer, then re-run."
  exit 1
fi

echo "Found: ${CER}"
security import "${CER}" -k ~/Library/Keychains/login.keychain-db -T /usr/bin/codesign -T /usr/bin/security || \
  security import "${CER}" -k ~/Library/Keychains/login.keychain-db

# Pair private key + cert into identity by importing both into keychain
# Create temp PEM chain for p12 export
CERT_PEM="$(mktemp)"
openssl x509 -inform DER -in "${CER}" -out "${CERT_PEM}" 2>/dev/null || openssl x509 -inform PEM -in "${CER}" -out "${CERT_PEM}"
openssl pkcs12 -export -inkey "${CSR_KEY}" -in "${CERT_PEM}" -out "${P12_OUT}" -passout "pass:${P12_PASS}" -name "Developer ID Application"
rm -f "${CERT_PEM}"

security import "${P12_OUT}" -k ~/Library/Keychains/login.keychain-db -P "${P12_PASS}" -T /usr/bin/codesign -T /usr/bin/security || true

IDENTITY="$(security find-identity -v -p codesigning | sed -n 's/.*"\(Developer ID Application:.*\)"/\1/p' | head -1)"
if [ -z "${IDENTITY}" ]; then
  echo "Certificate imported but identity not found yet. Open Keychain Access and ensure the private key is paired."
  security find-identity -v -p codesigning
  exit 1
fi

TEAM_ID="$(echo "${IDENTITY}" | sed -n 's/.*(\([^)]*\)).*/\1/p')"
echo "Identity: ${IDENTITY}"
echo "Team ID: ${TEAM_ID}"

# Wire tauri.conf.json signingIdentity
python3 - <<PY
import json
from pathlib import Path
p = Path("${PROJECT_ROOT}") / "src-tauri" / "tauri.conf.json"
data = json.loads(p.read_text())
data.setdefault("bundle", {}).setdefault("macOS", {})["signingIdentity"] = """${IDENTITY}"""
p.write_text(json.dumps(data, indent=2) + "\n")
print(f"Updated {p}")
PY

# Wire .env (create/update keys without dumping secrets)
touch "${ENV_FILE}"
python3 - <<PY
from pathlib import Path
env_path = Path("""${ENV_FILE}""")
text = env_path.read_text() if env_path.exists() else ""
updates = {
  "APPLE_SIGNING_IDENTITY": '''"${IDENTITY}"''',
  "APPLE_TEAM_ID": '''"${TEAM_ID}"''',
  "APPLE_ID": '"lemonx96@icloud.com"',
}
# Keep existing APPLE_PASSWORD if set
lines = text.splitlines()
keys_seen = set()
out = []
for line in lines:
  if not line.strip() or line.strip().startswith("#") or "=" not in line:
    out.append(line)
    continue
  k = line.split("=", 1)[0].strip()
  if k in updates:
    out.append(f"{k}={updates[k]}")
    keys_seen.add(k)
  else:
    out.append(line)
    keys_seen.add(k)
for k, v in updates.items():
  if k not in keys_seen:
    out.append(f"{k}={v}")
if "APPLE_PASSWORD" not in keys_seen:
  out.append('APPLE_PASSWORD=""  # app-specific password from appleid.apple.com')
env_path.write_text("\n".join(out).rstrip() + "\n")
print(f"Updated {env_path}")
PY

# Base64 for CI secret helper file (gitignored ideally)
B64_OUT="${HOME}/.tauri/developer-id-application.p12.base64"
openssl base64 -A -in "${P12_OUT}" -out "${B64_OUT}"
echo "P12: ${P12_OUT}"
echo "Base64 (for GitHub APPLE_CERTIFICATE secret): ${B64_OUT}"
echo "APPLE_CERTIFICATE_PASSWORD=${P12_PASS}"
echo "Done. Run: security find-identity -v -p codesigning | grep 'Developer ID Application'"
