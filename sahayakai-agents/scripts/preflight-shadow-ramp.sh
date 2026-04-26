#!/usr/bin/env bash
# Preflight checklist before flipping `parentCallSidecarMode` to shadow.
#
# Walks every gate the master plan requires before the first shadow
# flip can be safe. Returns 0 only if EVERY gate is green. Print
# remedy hints on each failure so the operator can fix in place.
#
# Usage:
#   bash scripts/preflight-shadow-ramp.sh \
#       --project sahayakai-b4248 \
#       --region asia-southeast1 \
#       --service sahayakai-agents-staging \
#       --invoker-sa sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com
#
# Gates checked:
#   1. Both deploy paths' SA flag is wired (read .github/workflows/cloud-run.yml + apphosting.yaml)
#   2. Sidecar Cloud Run service exists and is reachable
#   3. /healthz, /readyz, /.well-known/agent-card.json all return 200
#   4. POST /v1/parent-call/reply WITHOUT auth → 401 (IAM enforced)
#   5. SAHAYAKAI_REQUEST_SIGNING_KEY exists in Secret Manager and is ≥ 32 chars
#   6. SAHAYAKAI_AGENTS_AUDIENCE exists and equals the deployed service URL
#   7. GOOGLE_GENAI_SHADOW_API_KEY exists and is disjoint from GOOGLE_GENAI_API_KEY
#   8. Firestore `system_config/feature_flags` exists with parentCallSidecar* fields
#   9. Firestore TTL is enabled on agent_sessions.expireAt and calls.expireAt
#  10. auto-abort Cloud Function `parent-call-auto-abort` is deployed
#  11. shadow-diff aggregator function is deployed
#  12. parent-call-auto-abort Pub/Sub topic exists
#  13. All 6 alert policies in auto_abort/policy_templates/ are applied
#  14. Cloud Scheduler job for shadow-diff aggregator is enabled
#  15. tests/fixtures/parent_call_turns.json is present and ≥ 22 entries
#
# Round-2 audit reference: P0 PREFLIGHT-1 (every gate must be green
# BEFORE the first flag flip).

set -euo pipefail

PROJECT_ID=""
REGION=""
SERVICE_NAME=""
INVOKER_SA=""
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

usage() {
  echo "Usage: $0 --project <id> --region <r> --service <name> --invoker-sa <email>" >&2
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

PASS=0
FAIL=0
gate() {
  local name="$1"
  shift
  if "$@"; then
    PASS=$((PASS + 1))
    printf '\e[32m✓\e[0m %s\n' "${name}"
  else
    FAIL=$((FAIL + 1))
    printf '\e[31m✗\e[0m %s\n' "${name}"
  fi
}

# ── Gate 1: deploy paths ────────────────────────────────────────────────
check_deploy_paths() {
  grep -q "service-account=sahayakai-hotfix-resilience-runtime" \
    "${ROOT}/sahayakai-main/.github/workflows/cloud-run.yml" || return 1
  grep -q "serviceAccount: sahayakai-hotfix-resilience-runtime" \
    "${ROOT}/sahayakai-main/apphosting.yaml" || return 1
}
gate "deploy paths wired with sidecar SA" check_deploy_paths

# ── Gate 2: sidecar Cloud Run service exists ────────────────────────────
check_service() {
  gcloud run services describe "${SERVICE_NAME}" \
    --region="${REGION}" --project="${PROJECT_ID}" \
    --format='value(status.url)' >/tmp/preflight.url 2>/dev/null
  [[ -s /tmp/preflight.url ]]
}
gate "sidecar Cloud Run service exists" check_service

SERVICE_URL=""
[[ -s /tmp/preflight.url ]] && SERVICE_URL=$(cat /tmp/preflight.url)

# ── Gate 3: /healthz /readyz /.well-known/agent-card.json all 200 ──────
check_endpoints() {
  [[ -z "$SERVICE_URL" ]] && return 1
  for path in /healthz /readyz /.well-known/agent-card.json; do
    code=$(curl -s -o /dev/null -w '%{http_code}' "${SERVICE_URL}${path}")
    [[ "$code" == "200" ]] || return 1
  done
}
gate "sidecar liveness + readiness + A2A card return 200" check_endpoints

# ── Gate 4: POST without auth → 401 ─────────────────────────────────────
check_iam_invoker() {
  [[ -z "$SERVICE_URL" ]] && return 1
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    -H 'Content-Type: application/json' \
    -d '{}' "${SERVICE_URL}/v1/parent-call/reply")
  [[ "$code" == "401" ]]
}
gate "unauthenticated POST → 401 (IAM invoker enforced)" check_iam_invoker

# ── Gate 4b: Next.js SA actually has run.invoker on the sidecar ──────
check_nextjs_invoker_binding() {
  gcloud run services get-iam-policy "${SERVICE_NAME}" \
    --region="${REGION}" --project="${PROJECT_ID}" \
    --format='value(bindings.role,bindings.members)' 2>/dev/null \
    | grep -F 'roles/run.invoker' \
    | grep -F "serviceAccount:${INVOKER_SA}" >/dev/null
}
gate "Next.js SA has roles/run.invoker on the sidecar" check_nextjs_invoker_binding

# ── Gate 5: SAHAYAKAI_REQUEST_SIGNING_KEY ≥ 32 chars ────────────────────
check_signing_key() {
  val=$(gcloud secrets versions access latest \
    --secret=SAHAYAKAI_REQUEST_SIGNING_KEY \
    --project="${PROJECT_ID}" 2>/dev/null) || return 1
  [[ ${#val} -ge 32 ]]
}
gate "SAHAYAKAI_REQUEST_SIGNING_KEY ≥ 32 chars" check_signing_key

# ── Gate 6: SAHAYAKAI_AGENTS_AUDIENCE = service URL ────────────────────
check_audience_match() {
  [[ -z "$SERVICE_URL" ]] && return 1
  audience=$(gcloud secrets versions access latest \
    --secret=SAHAYAKAI_AGENTS_AUDIENCE \
    --project="${PROJECT_ID}" 2>/dev/null) || return 1
  [[ "$audience" == "$SERVICE_URL" ]]
}
gate "SAHAYAKAI_AGENTS_AUDIENCE secret matches deployed URL" check_audience_match

# ── Gate 7: shadow key disjoint from live pool ─────────────────────────
check_shadow_key_disjoint() {
  shadow=$(gcloud secrets versions access latest \
    --secret=GOOGLE_GENAI_SHADOW_API_KEY \
    --project="${PROJECT_ID}" 2>/dev/null) || return 1
  live=$(gcloud secrets versions access latest \
    --secret=GOOGLE_GENAI_API_KEY \
    --project="${PROJECT_ID}" 2>/dev/null) || return 1
  # Treat the live pool as comma-separated; shadow must not match any.
  IFS=',' read -ra live_arr <<< "$live"
  for k in "${live_arr[@]}"; do
    [[ "${k// /}" == "${shadow// /}" ]] && return 1
  done
  [[ -n "$shadow" ]]
}
gate "GOOGLE_GENAI_SHADOW_API_KEY disjoint from live pool" check_shadow_key_disjoint

# ── Gate 8: feature_flags doc seeded ────────────────────────────────────
check_feature_flags() {
  ACCESS_TOKEN=$(gcloud auth print-access-token --project="${PROJECT_ID}" 2>/dev/null)
  body=$(curl -s -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    "https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/system_config/feature_flags")
  echo "$body" | python3 -c "
import json, sys
b = json.load(sys.stdin)
fields = b.get('fields') or {}
sys.exit(0 if 'parentCallSidecarMode' in fields and 'parentCallSidecarPercent' in fields else 1)
"
}
gate "feature_flags doc has parentCallSidecar* fields" check_feature_flags

# ── Gate 9: Firestore TTL applied ───────────────────────────────────────
check_ttl() {
  for cgroup in agent_sessions shadow_calls; do
    state=$(gcloud firestore fields ttl describe expireAt \
      --collection-group="$cgroup" \
      --database='(default)' \
      --project="${PROJECT_ID}" \
      --format='value(state)' 2>/dev/null) || return 1
    [[ "$state" == "ACTIVE" ]] || return 1
  done
}
gate "Firestore TTL is ACTIVE on agent_sessions + shadow_calls" check_ttl

# ── Gate 10: auto-abort function deployed ───────────────────────────────
check_auto_abort_deployed() {
  gcloud functions describe parent-call-auto-abort \
    --gen2 --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1
}
gate "parent-call-auto-abort Cloud Function deployed" check_auto_abort_deployed

# ── Gate 11: shadow-diff aggregator deployed ────────────────────────────
check_shadow_rollup_deployed() {
  gcloud functions describe parent-call-shadow-rollup \
    --gen2 --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1
}
gate "parent-call-shadow-rollup Cloud Function deployed" check_shadow_rollup_deployed

# ── Gate 12: Pub/Sub topic exists ──────────────────────────────────────
check_pubsub_topic() {
  gcloud pubsub topics describe parent-call-auto-abort \
    --project="${PROJECT_ID}" >/dev/null 2>&1
}
gate "parent-call-auto-abort Pub/Sub topic exists" check_pubsub_topic

# ── Gate 13: 6 alert policies applied ──────────────────────────────────
check_alert_policies() {
  count=$(gcloud alpha monitoring policies list \
    --project="${PROJECT_ID}" \
    --filter='displayName ~ "parent-call sidecar"' \
    --format='value(name)' 2>/dev/null | wc -l)
  (( count >= 6 ))
}
gate "all 6 parent-call sidecar alert policies applied" check_alert_policies

# ── Gate 14: Cloud Scheduler job for rollup ────────────────────────────
check_scheduler() {
  gcloud scheduler jobs describe parent-call-shadow-rollup-cron \
    --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1
}
gate "parent-call-shadow-rollup-cron scheduler job exists" check_scheduler

# ── Gate 15: parity fixtures committed and >= 22 entries ───────────────
check_fixtures() {
  fix="${ROOT}/sahayakai-agents/tests/fixtures/parent_call_turns.json"
  [[ -f "$fix" ]] || return 1
  count=$(python3 -c "import json; d = json.load(open('${fix}')); print(len(d) if isinstance(d, list) else 0)")
  (( count >= 22 ))
}
gate "tests/fixtures/parent_call_turns.json has ≥ 22 entries" check_fixtures

# ── Summary ─────────────────────────────────────────────────────────────
echo
echo "──────────────────────────────────────────"
printf 'Preflight: %d passed, %d failed\n' "${PASS}" "${FAIL}"
echo "──────────────────────────────────────────"

if [[ "${FAIL}" -gt 0 ]]; then
  echo
  echo "Fix the failed gates before flipping parentCallSidecarMode to"
  echo "shadow. Each failure above has a specific remedy:"
  echo
  echo "  - deploy paths        → re-run cloud-run.yml + apphosting.yaml"
  echo "                          per fc91ee49a"
  echo "  - service exists      → cd sahayakai-agents && gcloud builds submit"
  echo "  - endpoints           → bash scripts/post-deploy-smoke.sh ..."
  echo "  - signing key         → bash scripts/generate-signing-key.sh ..."
  echo "  - audience            → bash scripts/hydrate-audience-secret.sh ..."
  echo "  - shadow key          → manual: gcloud secrets create + add disjoint key"
  echo "  - feature flags       → bash scripts/seed-feature-flags.sh ..."
  echo "  - TTL                 → bash scripts/apply-firestore-ttl.sh ..."
  echo "  - auto-abort fn       → cd cloud_functions/auto_abort && gcloud functions deploy"
  echo "  - shadow-rollup fn    → cd cloud_functions/shadow_diff_aggregator && gcloud functions deploy"
  echo "  - Pub/Sub topic       → gcloud pubsub topics create parent-call-auto-abort"
  echo "  - alert policies      → bash auto_abort/README.md apply loop"
  echo "  - scheduler           → see shadow_diff_aggregator/README.md"
  echo "  - fixtures            → cd sahayakai-main && npm run record:parent-call-fixtures"
  exit 1
fi

echo
printf '\e[32m✓\e[0m All gates green. Safe to flip parentCallSidecarMode to shadow.\n'
