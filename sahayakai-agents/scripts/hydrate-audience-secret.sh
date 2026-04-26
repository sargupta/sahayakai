#!/usr/bin/env bash
# Hydrate the SAHAYAKAI_AGENTS_AUDIENCE secret after the first deploy.
#
# Cloud Run assigns a URL only AFTER the service is created, so the
# audience claim used by the Next.js sidecar client cannot be known at
# deploy time. This script:
#
#   1. Resolves the deployed Cloud Run service URL via `gcloud run
#      services describe`.
#   2. Adds it as a NEW VERSION of the `SAHAYAKAI_AGENTS_AUDIENCE`
#      secret in Secret Manager.
#   3. Disables previous versions of that secret so a key rotation
#      cannot accidentally reuse a stale audience.
#
# Idempotent — safe to re-run on every deploy. Adds a no-op version if
# the URL has not changed.
#
# Usage:
#   bash scripts/hydrate-audience-secret.sh \
#       --service sahayakai-agents-staging \
#       --region asia-southeast1 \
#       --project sahayakai-b4248
#
# Required permissions for the caller:
#   - roles/run.viewer on the Cloud Run service
#   - roles/secretmanager.secretVersionAdder on
#     SAHAYAKAI_AGENTS_AUDIENCE
#   - roles/secretmanager.secretVersionManager (to disable old)
#
# Exit codes:
#   0 — secret hydrated (or already current)
#   1 — service or secret not found
#   2 — usage error

set -euo pipefail

SERVICE_NAME=""
REGION=""
PROJECT_ID=""
SECRET_NAME="SAHAYAKAI_AGENTS_AUDIENCE"

usage() {
  echo "Usage: $0 --service <name> --region <region> --project <project> [--secret <name>]" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service) SERVICE_NAME="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --project) PROJECT_ID="$2"; shift 2 ;;
    --secret) SECRET_NAME="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

[[ -z "$SERVICE_NAME" || -z "$REGION" || -z "$PROJECT_ID" ]] && usage

ok() { printf '\e[32m✓\e[0m %s\n' "$*"; }
fail() { printf '\e[31m✗\e[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\e[34m→\e[0m %s\n' "$*"; }

info "Resolving Cloud Run URL for ${SERVICE_NAME} in ${REGION} (project=${PROJECT_ID})"
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(status.url)' 2>/dev/null) || \
  fail "Cloud Run service ${SERVICE_NAME} not found in ${REGION}"

[[ -z "$SERVICE_URL" ]] && fail "service URL came back empty"
ok "Resolved URL: ${SERVICE_URL}"

# Check the secret exists.
if ! gcloud secrets describe "${SECRET_NAME}" \
    --project="${PROJECT_ID}" >/dev/null 2>&1; then
  fail "Secret ${SECRET_NAME} not found — create it first with: \
gcloud secrets create ${SECRET_NAME} --replication-policy=automatic --project=${PROJECT_ID}"
fi

# Read the current latest value (if any). If it matches, no-op.
CURRENT_URL=""
if CURRENT_URL=$(gcloud secrets versions access latest \
    --secret="${SECRET_NAME}" \
    --project="${PROJECT_ID}" 2>/dev/null); then
  if [[ "${CURRENT_URL}" == "${SERVICE_URL}" ]]; then
    ok "Secret already at the resolved URL; nothing to do."
    exit 0
  fi
  info "Current secret value differs (${CURRENT_URL}); rotating."
else
  info "Secret has no versions yet; creating the first."
fi

# Add the new version.
info "Adding new version to ${SECRET_NAME}"
echo -n "${SERVICE_URL}" | gcloud secrets versions add "${SECRET_NAME}" \
  --data-file=- \
  --project="${PROJECT_ID}" >/dev/null
NEW_VERSION=$(gcloud secrets versions list "${SECRET_NAME}" \
  --project="${PROJECT_ID}" \
  --filter="state=ENABLED" \
  --sort-by=~createTime \
  --limit=1 \
  --format='value(name)')
ok "New version: ${NEW_VERSION}"

# Disable any previous versions so a leaked stale credential cannot be
# replayed against the current audience.
info "Disabling stale versions"
gcloud secrets versions list "${SECRET_NAME}" \
  --project="${PROJECT_ID}" \
  --filter="state=ENABLED" \
  --format='value(name)' | while read -r version; do
  if [[ "${version}" != "${NEW_VERSION}" ]]; then
    gcloud secrets versions disable "${version}" \
      --secret="${SECRET_NAME}" \
      --project="${PROJECT_ID}" >/dev/null
    info "    disabled version ${version}"
  fi
done
ok "Older versions disabled."

echo
ok "Secret ${SECRET_NAME} hydrated."
echo "    URL: ${SERVICE_URL}"
echo "    Version: ${NEW_VERSION}"
echo
echo "Next: redeploy any consumer (Next.js runtime) so its mounted env"
echo "var picks up the new version. The mount itself does not auto-refresh."
