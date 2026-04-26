#!/usr/bin/env bash
# Seed the Firestore `system_config/feature_flags` document with the
# parent-call sidecar fields (parentCallSidecarMode + parentCallSidecarPercent).
#
# Why this is required:
# - The Next.js dispatcher reads `system_config/feature_flags` on every
#   TwiML hop. If the doc doesn't exist, `readConfig()` returns
#   `FALLBACK_CONFIG` (parentCallSidecarMode = 'off') which is safe
#   but DOES NOT write any state — the auto-abort Cloud Function
#   transaction would no-op because there's nothing to update.
# - For auto-abort to be able to demote the rollout (its entire job
#   is to write the flag back), the doc MUST exist with the new
#   fields populated. This script creates the minimum viable doc.
#
# Idempotent: if the doc exists and the fields are already present,
# this is a no-op. If the doc exists but is missing the new fields,
# they are added (other fields preserved). Never overwrites a
# non-default value once set.
#
# Usage:
#   bash scripts/seed-feature-flags.sh \
#       --project sahayakai-b4248 \
#       --database "(default)"
#
# Required permissions for the caller:
#   - roles/datastore.user
#
# Exit codes:
#   0 — doc seeded or already current
#   1 — Firestore not reachable, or write failed
#   2 — usage error

set -euo pipefail

PROJECT_ID=""
DATABASE="(default)"
DOC_PATH="system_config/feature_flags"

usage() {
  echo "Usage: $0 --project <project-id> [--database <id>]" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="$2"; shift 2 ;;
    --database) DATABASE="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

[[ -z "$PROJECT_ID" ]] && usage

ok() { printf '\e[32m✓\e[0m %s\n' "$*"; }
fail() { printf '\e[31m✗\e[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\e[34m→\e[0m %s\n' "$*"; }

command -v gcloud >/dev/null 2>&1 || fail "gcloud not found"
command -v python3 >/dev/null 2>&1 || fail "python3 not found"

# Use the gcloud Firestore REST helper via curl + access token.
ACCESS_TOKEN=$(gcloud auth print-access-token --project="${PROJECT_ID}" 2>/dev/null)
[[ -z "$ACCESS_TOKEN" ]] && fail "could not mint access token"

API_BASE="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}/documents"

# Encode the path; (default) needs escaping.
PATH_ENC=$(python3 -c "import urllib.parse; import sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "${DATABASE}")
DOC_URL="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${PATH_ENC}/documents/${DOC_PATH}"

info "Reading ${DOC_URL}"
GET_BODY=$(curl -s -H "Authorization: Bearer ${ACCESS_TOKEN}" "${DOC_URL}" || true)

# Parse: does the doc exist? Are our two new fields present?
NEEDS_SEED=1
NEEDS_PATCH=0
if [[ -n "${GET_BODY}" ]] && echo "${GET_BODY}" | python3 -c "
import json, sys
body = json.load(sys.stdin)
if body.get('error'):
    sys.exit(99)
fields = body.get('fields') or {}
has_mode = 'parentCallSidecarMode' in fields
has_pct = 'parentCallSidecarPercent' in fields
sys.exit(0 if has_mode and has_pct else (1 if 'fields' in body else 99))
" 2>/dev/null; then
  ok "Doc already has parentCallSidecar* fields; nothing to do."
  exit 0
fi

CHECK_RC=$?
case "${CHECK_RC}" in
  1) NEEDS_PATCH=1; NEEDS_SEED=0; info "Doc exists but is missing the new fields — patching" ;;
  99) info "Doc does not exist — creating" ;;
  *) fail "unexpected check return code: ${CHECK_RC}" ;;
esac

# Build the patch body. PATCH semantics: the `fields` block specifies
# only what to write; `updateMask` specifies which top-level fields
# to update. Other fields in the doc are preserved.
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PATCH_BODY=$(cat <<JSON
{
  "fields": {
    "parentCallSidecarMode": { "stringValue": "off" },
    "parentCallSidecarPercent": { "integerValue": "0" },
    "updatedAt": { "timestampValue": "${NOW}" },
    "updatedBy": { "stringValue": "seed-feature-flags-script" }
  }
}
JSON
)

QUERY="updateMask.fieldPaths=parentCallSidecarMode&updateMask.fieldPaths=parentCallSidecarPercent&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=updatedBy"
if [[ "$NEEDS_SEED" == "1" ]]; then
  # Allow create on missing.
  QUERY="${QUERY}&currentDocument.exists=false"
fi

info "Patching ${DOC_PATH} (${QUERY})"
PATCH_RESPONSE=$(curl -sS -X PATCH \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "${PATCH_BODY}" \
  "${DOC_URL}?${QUERY}")

# Verify
if echo "${PATCH_RESPONSE}" | python3 -c "import json, sys; b = json.load(sys.stdin); sys.exit(0 if b.get('name') else 1)" 2>/dev/null; then
  ok "  ${DOC_PATH} written"
else
  echo "${PATCH_RESPONSE}" >&2
  fail "patch failed; see Firestore response above"
fi

echo
ok "Feature flags seeded."
echo
echo "Verify in Cloud Console:"
echo "  https://console.cloud.google.com/firestore/databases/${DATABASE}/data/panel/system_config/feature_flags?project=${PROJECT_ID}"
echo
echo "Initial values: parentCallSidecarMode='off', parentCallSidecarPercent=0."
echo "Operator must manually flip these via Console (or a CLI tool) when"
echo "ready for shadow ramp."
