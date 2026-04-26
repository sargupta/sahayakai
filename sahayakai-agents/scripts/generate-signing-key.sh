#!/usr/bin/env bash
# Generate the SAHAYAKAI_REQUEST_SIGNING_KEY HMAC secret.
#
# Generates a fresh 256-bit (32-byte) random key, base64-encodes it,
# and stores it as a new version of the Secret Manager secret. Creates
# the secret container if it doesn't exist.
#
# Why a 256-bit key:
# - HMAC-SHA256 is the digest algorithm used by `signing.ts` for the
#   X-Content-Digest header. A key shorter than the digest output
#   weakens the MAC; longer than 64 bytes is hashed before keying so
#   it adds no security. 32 bytes is the sweet spot.
# - The signing.ts loader rejects keys < 32 chars (length check). The
#   base64 output of 32 random bytes is 44 chars — comfortably above
#   the floor.
#
# Idempotent: every run adds a NEW VERSION. The previous version is
# disabled at the end so a leaked key cannot be replayed. Re-running
# is the documented rotation procedure.
#
# Usage:
#   bash scripts/generate-signing-key.sh \
#       --project sahayakai-b4248 \
#       [--secret SAHAYAKAI_REQUEST_SIGNING_KEY] \
#       [--keep-previous]    # do NOT disable the prior version
#
# After this script runs, both consumers (Next.js runtime + sahayakai-
# agents sidecar) need a redeploy to pick up the new version because
# Cloud Run secret mounts do not auto-refresh.
#
# Required permissions for the caller:
#   - roles/secretmanager.secretVersionAdder
#   - roles/secretmanager.secretVersionManager (to disable the old)
#   - openssl (any modern macOS / Linux ships with it)
#
# Exit codes:
#   0 — secret rotated successfully
#   1 — gcloud / openssl not available, or secret rotation failed
#   2 — usage error

set -euo pipefail

PROJECT_ID=""
SECRET_NAME="SAHAYAKAI_REQUEST_SIGNING_KEY"
KEEP_PREVIOUS=0

usage() {
  echo "Usage: $0 --project <project-id> [--secret <name>] [--keep-previous]" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="$2"; shift 2 ;;
    --secret) SECRET_NAME="$2"; shift 2 ;;
    --keep-previous) KEEP_PREVIOUS=1; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

[[ -z "$PROJECT_ID" ]] && usage

ok() { printf '\e[32m✓\e[0m %s\n' "$*"; }
fail() { printf '\e[31m✗\e[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\e[34m→\e[0m %s\n' "$*"; }

command -v openssl >/dev/null 2>&1 || fail "openssl not found"
command -v gcloud >/dev/null 2>&1 || fail "gcloud not found"

# ── Create the secret container if missing ─────────────────────────────
if ! gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  info "Secret ${SECRET_NAME} does not exist — creating"
  gcloud secrets create "${SECRET_NAME}" \
    --replication-policy=automatic \
    --project="${PROJECT_ID}" >/dev/null
  ok "  ${SECRET_NAME} created"
fi

# ── Generate fresh key (32 bytes → 44-char base64) ─────────────────────
NEW_KEY=$(openssl rand -base64 32)
[[ ${#NEW_KEY} -lt 32 ]] && fail "generated key is suspiciously short (${#NEW_KEY} chars)"
ok "Generated 32-byte HMAC key (${#NEW_KEY} base64 chars)"

# ── Add as new version ─────────────────────────────────────────────────
info "Adding new version to ${SECRET_NAME}"
echo -n "${NEW_KEY}" | gcloud secrets versions add "${SECRET_NAME}" \
  --data-file=- \
  --project="${PROJECT_ID}" >/dev/null
NEW_VERSION=$(gcloud secrets versions list "${SECRET_NAME}" \
  --project="${PROJECT_ID}" \
  --filter="state=ENABLED" \
  --sort-by=~createTime \
  --limit=1 \
  --format='value(name)')
ok "  new version: ${NEW_VERSION}"

# ── Optionally disable previous versions ───────────────────────────────
if [[ "$KEEP_PREVIOUS" == "0" ]]; then
  info "Disabling stale versions"
  STALE_COUNT=0
  gcloud secrets versions list "${SECRET_NAME}" \
    --project="${PROJECT_ID}" \
    --filter="state=ENABLED" \
    --format='value(name)' | while read -r version; do
    if [[ "${version}" != "${NEW_VERSION}" ]]; then
      gcloud secrets versions disable "${version}" \
        --secret="${SECRET_NAME}" \
        --project="${PROJECT_ID}" >/dev/null
      STALE_COUNT=$((STALE_COUNT + 1))
      info "    disabled version ${version}"
    fi
  done
  ok "  Stale versions disabled."
else
  info "  --keep-previous set; older versions remain enabled."
fi

echo
ok "Signing key rotated."
echo
echo "Next steps:"
echo "  1. Redeploy the Next.js runtime so its mounted secret env var"
echo "     refreshes:"
echo "       cd sahayakai-main && ..."
echo "  2. Redeploy the sahayakai-agents sidecar so the same secret"
echo "     mount refreshes there:"
echo "       cd sahayakai-agents && gcloud builds submit --config=deploy/cloudbuild.yaml"
echo
echo "Both runtimes must use the SAME secret version or HMAC verification"
echo "will fail and the dispatcher's behavioural-error fallback to canned"
echo "wrap-up will trigger on every call."
