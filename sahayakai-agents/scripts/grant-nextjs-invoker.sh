#!/usr/bin/env bash
# Grant the Next.js runtime SA `roles/run.invoker` on the deployed
# sidecar service. MUST run AFTER `gcloud builds submit` deploys the
# sidecar, because the binding requires the service to exist.
#
# Without this grant, every TwiML hop that dispatches to the sidecar
# returns 401 (sidecar's IAM invoker check rejects unknown identities).
# The dispatcher then falls back to Genkit on every call — silently
# masking the auth-misconfiguration as a transport error.
#
# This script was split out from `bootstrap-track-d.sh` because that
# script runs BEFORE the first sidecar deploy and so cannot bind a
# role on a service that doesn't yet exist.
#
# Idempotent: re-applying an existing binding is a no-op via
# `add-iam-policy-binding`'s native dedupe.
#
# Usage:
#   bash scripts/grant-nextjs-invoker.sh \
#       --project sahayakai-b4248 \
#       --region asia-southeast1 \
#       --service sahayakai-agents-staging \
#       --invoker-sa sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com
#
# Required permissions for the caller:
#   - roles/run.admin OR roles/iam.securityAdmin on the sidecar service
#
# Exit codes:
#   0 — binding applied (or already present)
#   1 — service not found, or binding failed
#   2 — usage error
#
# Round-2 audit reference: P0 IAM-4 (deferred run.invoker grant).

set -euo pipefail

PROJECT_ID=""
REGION=""
SERVICE_NAME=""
INVOKER_SA=""

usage() {
  echo "Usage: $0 --project <id> --region <region> --service <name> --invoker-sa <email>" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --service) SERVICE_NAME="$2"; shift 2 ;;
    --invoker-sa) INVOKER_SA="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

[[ -z "$PROJECT_ID" || -z "$REGION" || -z "$SERVICE_NAME" || -z "$INVOKER_SA" ]] && usage

ok() { printf '\e[32m✓\e[0m %s\n' "$*"; }
fail() { printf '\e[31m✗\e[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\e[34m→\e[0m %s\n' "$*"; }

command -v gcloud >/dev/null 2>&1 || fail "gcloud not found"

# ── Verify service exists ──────────────────────────────────────────────
info "Verifying ${SERVICE_NAME} exists in ${REGION}"
if ! gcloud run services describe "${SERVICE_NAME}" \
    --region="${REGION}" --project="${PROJECT_ID}" \
    --format='value(metadata.name)' >/dev/null 2>&1; then
  fail "Cloud Run service ${SERVICE_NAME} not found in ${REGION}. Deploy the sidecar first via cloudbuild.yaml."
fi
ok "  ${SERVICE_NAME} found"

# ── Verify invoker SA exists ───────────────────────────────────────────
info "Verifying invoker SA ${INVOKER_SA} exists"
if ! gcloud iam service-accounts describe "${INVOKER_SA}" \
    --project="${PROJECT_ID}" >/dev/null 2>&1; then
  fail "Service account ${INVOKER_SA} not found. Run scripts/bootstrap-track-d.sh first."
fi
ok "  ${INVOKER_SA} found"

# ── Apply the binding ──────────────────────────────────────────────────
info "Granting roles/run.invoker on ${SERVICE_NAME} to ${INVOKER_SA}"
gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --member="serviceAccount:${INVOKER_SA}" \
  --role=roles/run.invoker \
  --quiet >/dev/null
ok "  binding applied"

# ── Verify ─────────────────────────────────────────────────────────────
info "Verifying binding is in the policy"
BOUND=$(gcloud run services get-iam-policy "${SERVICE_NAME}" \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --format='value(bindings.members)' 2>/dev/null \
  | tr ';' '\n' | tr ',' '\n' | grep -F "serviceAccount:${INVOKER_SA}" | head -1)

if [[ -z "${BOUND}" ]]; then
  fail "Binding NOT visible in the IAM policy after add. Re-run or inspect manually."
fi
ok "  binding confirmed present"

echo
ok "Next.js runtime SA can now invoke ${SERVICE_NAME}."
echo
echo "Next: run scripts/post-deploy-smoke.sh to verify end-to-end."
