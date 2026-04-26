#!/usr/bin/env bash
# One-shot Track D bootstrap. Creates EVERY GCP resource the parent-call
# sidecar pilot needs before the first shadow flag flip:
#
#   1. Service accounts (4 of them) + IAM bindings
#   2. Secret Manager containers (3 secrets)
#   3. Pub/Sub topic for auto-abort alerts
#   4. Auto-abort Cloud Function (Pub/Sub trigger)
#   5. Auto-abort Cloud Function HTTP variant (manual dry-run)
#   6. Shadow-diff aggregator Cloud Function (HTTP trigger)
#   7. Cloud Scheduler job that hits the rollup every 5 min
#   8. All 6 Cloud Monitoring alert policies
#
# Idempotent for every step — re-running on a partially-applied state
# resumes from where it left off, or skips with a notice.
#
# Operator workflow:
#
#   # 1. Apply Firestore rules
#   cd sahayakai-main && firebase deploy --only firestore:rules
#
#   # 2. Run this script (one-shot bootstrap)
#   cd sahayakai-agents
#   bash scripts/bootstrap-track-d.sh \
#       --project sahayakai-b4248 \
#       --region asia-southeast1
#
#   # 3. Apply Firestore TTL
#   bash scripts/apply-firestore-ttl.sh --project sahayakai-b4248
#
#   # 4. Generate signing key + seed feature flags
#   bash scripts/generate-signing-key.sh --project sahayakai-b4248
#   bash scripts/seed-feature-flags.sh --project sahayakai-b4248
#
#   # 5. Deploy the sidecar
#   gcloud builds submit --config=deploy/cloudbuild.yaml
#
#   # 6. Hydrate audience secret + smoke test
#   bash scripts/hydrate-audience-secret.sh \
#       --service sahayakai-agents-staging --region asia-southeast1 --project sahayakai-b4248
#   bash scripts/post-deploy-smoke.sh \
#       --url https://... --invoker-sa sahayakai-hotfix-resilience-runtime@...
#
#   # 7. Final preflight check
#   bash scripts/preflight-shadow-ramp.sh \
#       --project sahayakai-b4248 --region asia-southeast1 \
#       --service sahayakai-agents-staging \
#       --invoker-sa sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com
#
#   # 8. Flip parentCallSidecarMode to "shadow" in Firestore.
#
# Required permissions for the caller:
#   - roles/iam.serviceAccountAdmin (create SAs)
#   - roles/iam.securityAdmin (grant roles)
#   - roles/secretmanager.admin (create secret containers)
#   - roles/pubsub.editor (create topic)
#   - roles/cloudfunctions.developer (deploy functions)
#   - roles/cloudscheduler.admin (create scheduler job)
#   - roles/monitoring.alertPolicyEditor (create alert policies)
#
# Round-2 audit reference: P0 BOOTSTRAP-1 (one-shot reproducible bootstrap).

set -euo pipefail

PROJECT_ID=""
REGION=""
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# SA names (without @project.iam.gserviceaccount.com suffix).
SA_AGENTS="sahayakai-agents-runtime"
SA_NEXTJS="sahayakai-hotfix-resilience-runtime"
SA_AUTO_ABORT="sahayakai-auto-abort-runtime"
SA_SHADOW_ROLLUP="sahayakai-shadow-rollup-runtime"

PUBSUB_TOPIC="parent-call-auto-abort"
NOTIFICATION_CHANNEL_NAME="parent-call auto-abort"

usage() {
  echo "Usage: $0 --project <id> --region <region>" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

[[ -z "$PROJECT_ID" || -z "$REGION" ]] && usage

ok() { printf '\e[32m✓\e[0m %s\n' "$*"; }
fail() { printf '\e[31m✗\e[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\e[34m→\e[0m %s\n' "$*"; }
section() { printf '\n\e[1m── %s ──\e[0m\n' "$*"; }

# ── Helper: idempotent SA create ────────────────────────────────────────
ensure_sa() {
  local name="$1"
  local description="$2"
  local email="${name}@${PROJECT_ID}.iam.gserviceaccount.com"
  if gcloud iam service-accounts describe "${email}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    info "  ${email} already exists"
  else
    gcloud iam service-accounts create "${name}" \
      --description="${description}" \
      --display-name="${name}" \
      --project="${PROJECT_ID}" >/dev/null
    ok "  created ${email}"
  fi
}

# ── Helper: idempotent role grant ───────────────────────────────────────
grant_role() {
  local member="$1"  # serviceAccount:foo@... or user:bar@...
  local role="$2"
  # `gcloud projects add-iam-policy-binding` is idempotent.
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="${member}" \
    --role="${role}" \
    --condition=None \
    --quiet >/dev/null 2>&1 || true
}

# ── Helper: idempotent secret container create ─────────────────────────
ensure_secret() {
  local secret="$1"
  if gcloud secrets describe "${secret}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    info "  ${secret} already exists"
  else
    gcloud secrets create "${secret}" \
      --replication-policy=automatic \
      --project="${PROJECT_ID}" >/dev/null
    ok "  created ${secret}"
  fi
}

# ── 1. Service accounts ─────────────────────────────────────────────────
section "1/8  Service accounts"
ensure_sa "${SA_AGENTS}" "Sidecar runtime SA — Cloud Run sahayakai-agents"
ensure_sa "${SA_NEXTJS}" "Next.js runtime SA — invokes the sidecar"
ensure_sa "${SA_AUTO_ABORT}" "Auto-abort Cloud Function runtime SA"
ensure_sa "${SA_SHADOW_ROLLUP}" "Shadow-diff aggregator function runtime SA"

# ── 2. IAM bindings ────────────────────────────────────────────────────
section "2/8  IAM bindings"

AGENTS_EMAIL="${SA_AGENTS}@${PROJECT_ID}.iam.gserviceaccount.com"
NEXTJS_EMAIL="${SA_NEXTJS}@${PROJECT_ID}.iam.gserviceaccount.com"
AUTO_ABORT_EMAIL="${SA_AUTO_ABORT}@${PROJECT_ID}.iam.gserviceaccount.com"
SHADOW_ROLLUP_EMAIL="${SA_SHADOW_ROLLUP}@${PROJECT_ID}.iam.gserviceaccount.com"

# Round-2 audit P0 IAM-3 fix (30-agent review, group D3): drop the
# project-level `roles/secretmanager.secretAccessor` grants. They give
# Next.js access to ALL secrets in the project — including
# GOOGLE_GENAI_SHADOW_API_KEY and FIREBASE_SERVICE_ACCOUNT_KEY — neither
# of which Next.js should ever read. Per-secret bindings in section 3
# below grant exactly the secrets each SA actually needs.

# Agents (sidecar) runtime — project-wide read/write/trace/log only.
# Per-secret accessor bindings are applied in section 3.
info "  ${AGENTS_EMAIL}"
grant_role "serviceAccount:${AGENTS_EMAIL}" "roles/datastore.user"
grant_role "serviceAccount:${AGENTS_EMAIL}" "roles/cloudtrace.agent"
grant_role "serviceAccount:${AGENTS_EMAIL}" "roles/logging.logWriter"

# Next.js runtime — same shape; per-secret accessor bindings in section 3.
info "  ${NEXTJS_EMAIL}"
grant_role "serviceAccount:${NEXTJS_EMAIL}" "roles/datastore.user"
grant_role "serviceAccount:${NEXTJS_EMAIL}" "roles/logging.logWriter"
# `roles/run.invoker` on the sidecar service is granted by
# `scripts/grant-nextjs-invoker.sh` AFTER the sidecar deploys (section 5
# of the runbook). Cannot be granted here because the service does not
# yet exist.

# Auto-abort runtime
info "  ${AUTO_ABORT_EMAIL}"
grant_role "serviceAccount:${AUTO_ABORT_EMAIL}" "roles/datastore.user"
grant_role "serviceAccount:${AUTO_ABORT_EMAIL}" "roles/logging.logWriter"

# Shadow-rollup runtime
info "  ${SHADOW_ROLLUP_EMAIL}"
grant_role "serviceAccount:${SHADOW_ROLLUP_EMAIL}" "roles/datastore.user"
grant_role "serviceAccount:${SHADOW_ROLLUP_EMAIL}" "roles/monitoring.metricWriter"
grant_role "serviceAccount:${SHADOW_ROLLUP_EMAIL}" "roles/logging.logWriter"

ok "IAM bindings applied (idempotent — silent on already-bound)."

# ── 3. Secret Manager containers ───────────────────────────────────────
section "3/8  Secret Manager containers"
ensure_secret SAHAYAKAI_REQUEST_SIGNING_KEY
ensure_secret SAHAYAKAI_AGENTS_AUDIENCE
ensure_secret GOOGLE_GENAI_SHADOW_API_KEY

# Grant runtime read access on each.
#
# Tight scope per Round-2 audit IAM-3: each SA gets ONLY the secrets it
# actually reads. NEVER grants Next.js the shadow-key (sidecar-only) or
# the shadow key access to FIREBASE_SERVICE_ACCOUNT_KEY (Next.js-only).
#
# Both runtimes share SIGNING_KEY (HMAC sign on Next.js, HMAC verify
# on sidecar) and AGENTS_AUDIENCE (mint-token audience on Next.js,
# verify-token audience on sidecar).
for secret in SAHAYAKAI_REQUEST_SIGNING_KEY SAHAYAKAI_AGENTS_AUDIENCE; do
  for sa in "${AGENTS_EMAIL}" "${NEXTJS_EMAIL}"; do
    gcloud secrets add-iam-policy-binding "${secret}" \
      --member="serviceAccount:${sa}" \
      --role=roles/secretmanager.secretAccessor \
      --project="${PROJECT_ID}" --quiet >/dev/null 2>&1 || true
  done
done

# Sidecar-only secrets (live + shadow Gemini keys).
for secret in GOOGLE_GENAI_API_KEY GOOGLE_GENAI_SHADOW_API_KEY; do
  if gcloud secrets describe "${secret}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud secrets add-iam-policy-binding "${secret}" \
      --member="serviceAccount:${AGENTS_EMAIL}" \
      --role=roles/secretmanager.secretAccessor \
      --project="${PROJECT_ID}" --quiet >/dev/null 2>&1 || true
  fi
done

# Next.js-only secrets (Firebase Admin SDK key, Firebase web API key).
for secret in FIREBASE_SERVICE_ACCOUNT_KEY NEXT_PUBLIC_FIREBASE_API_KEY YOUTUBE_API_KEY; do
  if gcloud secrets describe "${secret}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud secrets add-iam-policy-binding "${secret}" \
      --member="serviceAccount:${NEXTJS_EMAIL}" \
      --role=roles/secretmanager.secretAccessor \
      --project="${PROJECT_ID}" --quiet >/dev/null 2>&1 || true
  fi
done

ok "Per-secret accessor bindings applied (tight scope)."

# ── 4. Pub/Sub topic ───────────────────────────────────────────────────
section "4/8  Pub/Sub topic"
if gcloud pubsub topics describe "${PUBSUB_TOPIC}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  info "  ${PUBSUB_TOPIC} already exists"
else
  gcloud pubsub topics create "${PUBSUB_TOPIC}" --project="${PROJECT_ID}" >/dev/null
  ok "  created topic ${PUBSUB_TOPIC}"
fi

# ── 5. Auto-abort Cloud Function ───────────────────────────────────────
section "5/8  Auto-abort Cloud Function (Pub/Sub trigger)"
gcloud functions deploy parent-call-auto-abort \
  --gen2 \
  --runtime=python312 \
  --region="${REGION}" \
  --source="${ROOT_DIR}/cloud_functions/auto_abort" \
  --entry-point=auto_abort_pubsub \
  --trigger-topic="${PUBSUB_TOPIC}" \
  --service-account="${AUTO_ABORT_EMAIL}" \
  --memory=256Mi \
  --timeout=60s \
  --max-instances=3 \
  --project="${PROJECT_ID}" \
  --quiet >/dev/null
ok "  parent-call-auto-abort deployed"

# Also deploy the HTTP variant for manual dry-runs.
info "  HTTP variant (dry-run target)"
gcloud functions deploy parent-call-auto-abort-http \
  --gen2 \
  --runtime=python312 \
  --region="${REGION}" \
  --source="${ROOT_DIR}/cloud_functions/auto_abort" \
  --entry-point=auto_abort_http \
  --trigger-http \
  --no-allow-unauthenticated \
  --service-account="${AUTO_ABORT_EMAIL}" \
  --memory=256Mi \
  --timeout=60s \
  --max-instances=1 \
  --project="${PROJECT_ID}" \
  --quiet >/dev/null
ok "  parent-call-auto-abort-http deployed"

# ── 6. Shadow-rollup Cloud Function ────────────────────────────────────
section "6/8  Shadow-diff aggregator Cloud Function"
gcloud functions deploy parent-call-shadow-rollup \
  --gen2 \
  --runtime=python312 \
  --region="${REGION}" \
  --source="${ROOT_DIR}/cloud_functions/shadow_diff_aggregator" \
  --entry-point=shadow_rollup_http \
  --trigger-http \
  --no-allow-unauthenticated \
  --service-account="${SHADOW_ROLLUP_EMAIL}" \
  --memory=1Gi \
  --timeout=300s \
  --max-instances=2 \
  --set-env-vars="USE_EMBEDDINGS=0,WINDOW_SIZE=500" \
  --project="${PROJECT_ID}" \
  --quiet >/dev/null
ok "  parent-call-shadow-rollup deployed"

# ── 7. Cloud Scheduler — every 5 min hit the rollup ───────────────────
section "7/8  Cloud Scheduler — shadow-rollup cron"
ROLLUP_URL=$(gcloud functions describe parent-call-shadow-rollup \
  --gen2 --region="${REGION}" --project="${PROJECT_ID}" \
  --format='value(serviceConfig.uri)')

if gcloud scheduler jobs describe parent-call-shadow-rollup-cron \
    --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  info "  scheduler job already exists; updating schedule"
  gcloud scheduler jobs update http parent-call-shadow-rollup-cron \
    --location="${REGION}" \
    --schedule="*/5 * * * *" \
    --uri="${ROLLUP_URL}" \
    --http-method=POST \
    --oidc-service-account-email="${SHADOW_ROLLUP_EMAIL}" \
    --oidc-token-audience="${ROLLUP_URL}" \
    --project="${PROJECT_ID}" --quiet >/dev/null
else
  gcloud scheduler jobs create http parent-call-shadow-rollup-cron \
    --location="${REGION}" \
    --schedule="*/5 * * * *" \
    --uri="${ROLLUP_URL}" \
    --http-method=POST \
    --oidc-service-account-email="${SHADOW_ROLLUP_EMAIL}" \
    --oidc-token-audience="${ROLLUP_URL}" \
    --project="${PROJECT_ID}" --quiet >/dev/null
fi
ok "  parent-call-shadow-rollup-cron @ */5 * * * *"

# Also let the scheduler invoke the function (Cloud Run invoker).
gcloud functions add-invoker-policy-binding parent-call-shadow-rollup \
  --region="${REGION}" \
  --member="serviceAccount:${SHADOW_ROLLUP_EMAIL}" \
  --project="${PROJECT_ID}" --quiet >/dev/null 2>&1 || true

# ── 8. Cloud Monitoring alert policies ─────────────────────────────────
section "8/8  Cloud Monitoring alert policies"

# Ensure the Pub/Sub notification channel exists.
CHANNEL_NAME=$(gcloud alpha monitoring channels list \
  --project="${PROJECT_ID}" \
  --filter="displayName=\"${NOTIFICATION_CHANNEL_NAME}\"" \
  --format='value(name)' 2>/dev/null | head -1)

if [[ -z "${CHANNEL_NAME}" ]]; then
  CHANNEL_NAME=$(gcloud alpha monitoring channels create \
    --display-name="${NOTIFICATION_CHANNEL_NAME}" \
    --type=pubsub \
    --channel-labels="topic=projects/${PROJECT_ID}/topics/${PUBSUB_TOPIC}" \
    --project="${PROJECT_ID}" \
    --format='value(name)')
  ok "  created notification channel ${CHANNEL_NAME}"
else
  info "  notification channel exists: ${CHANNEL_NAME}"
fi

# Apply each YAML, substituting the channel placeholder.
for policy_file in "${ROOT_DIR}/cloud_functions/auto_abort/policy_templates/"*.yaml; do
  policy_name=$(python3 -c "import yaml; print(yaml.safe_load(open('${policy_file}'))['displayName'])")
  if gcloud alpha monitoring policies list \
      --project="${PROJECT_ID}" \
      --filter="displayName=\"${policy_name}\"" \
      --format='value(name)' 2>/dev/null | grep -q .; then
    info "  ${policy_name} already exists"
    continue
  fi

  rendered="/tmp/$(basename "${policy_file}")"
  sed "s|\${AUTO_ABORT_PUBSUB_CHANNEL}|${CHANNEL_NAME}|g" \
    "${policy_file}" > "${rendered}"
  gcloud alpha monitoring policies create \
    --project="${PROJECT_ID}" \
    --policy-from-file="${rendered}" \
    --quiet >/dev/null
  ok "  applied ${policy_name}"
done

# ── Summary ────────────────────────────────────────────────────────────
echo
echo "──────────────────────────────────────────"
ok "Track D bootstrap complete."
echo "──────────────────────────────────────────"
echo
echo "Next steps (run from repo root):"
echo "  bash sahayakai-agents/scripts/apply-firestore-ttl.sh --project ${PROJECT_ID}"
echo "  bash sahayakai-agents/scripts/generate-signing-key.sh --project ${PROJECT_ID}"
echo "  bash sahayakai-agents/scripts/seed-feature-flags.sh --project ${PROJECT_ID}"
echo
echo "Then deploy the sidecar, hydrate the audience, smoke test, and"
echo "run the preflight checklist:"
echo "  cd sahayakai-agents"
echo "  gcloud builds submit --config=deploy/cloudbuild.yaml"
echo "  bash scripts/hydrate-audience-secret.sh --service sahayakai-agents-staging --region ${REGION} --project ${PROJECT_ID}"
echo "  bash scripts/post-deploy-smoke.sh --url <SERVICE_URL> --invoker-sa ${NEXTJS_EMAIL}"
echo "  bash scripts/preflight-shadow-ramp.sh --project ${PROJECT_ID} --region ${REGION} --service sahayakai-agents-staging --invoker-sa ${NEXTJS_EMAIL}"
echo
echo "Once preflight is all-green, flip parentCallSidecarMode in Firestore:"
echo "  gcloud firestore documents patch system_config/feature_flags \\"
echo "      --project=${PROJECT_ID} \\"
echo "      --data='{\"parentCallSidecarMode\":\"shadow\",\"parentCallSidecarPercent\":1}'"
