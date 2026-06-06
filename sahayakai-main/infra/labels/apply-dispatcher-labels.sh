#!/usr/bin/env bash
# Q3E cost-attribution: apply Cloud Run labels on every service
# (sidecar + dispatcher, prod + non-prod) so Cloud Billing's BigQuery
# export can split spend by service-tier and cost-bucket.
#
# Sidecar labels also live in deploy/service.yaml (rendered by
# cloudbuild.yaml on every deploy) — this script is idempotent and
# safe to run alongside that pipeline. It is the canonical command for
# the dispatcher services (Next.js) since they are deployed via
# scripts/safe-deploy.sh and not via a service.yaml apply.
#
# Verify post-apply:
#   gcloud run services describe sahayakai-hotfix-resilience \
#     --region=asia-southeast1 --format='value(metadata.labels)'
set -euo pipefail

PROJECT="${PROJECT:-sahayakai-b4248}"
REGION="${REGION:-asia-southeast1}"

apply() {
  local service="$1"; shift
  local labels="$1"; shift
  echo ">> ${service}: ${labels}"
  gcloud run services update "${service}" \
    --project="${PROJECT}" \
    --region="${REGION}" \
    --update-labels="${labels}" \
    --quiet
}

# Sidecar (Python ADK).
apply sahayakai-agents          "service-tier=sidecar,cost-bucket=adk-prod"
apply sahayakai-agents-staging  "service-tier=sidecar,cost-bucket=adk-staging"

# Dispatcher (Next.js).
apply sahayakai-hotfix-resilience "service-tier=dispatcher,cost-bucket=prod-web"
apply sahayakai-preview            "service-tier=dispatcher,cost-bucket=preview-web"

echo "Done. BigQuery billing rows will reflect new labels in ~24 h."
