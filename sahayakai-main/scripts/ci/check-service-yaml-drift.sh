#!/usr/bin/env bash
# CI gate: compare live Cloud Run service config against the spec in
# qa/results/lane-F/SERVICE_YAML_VERIFY.md. Read-only.
set -euo pipefail
PROJECT="${GCP_PROJECT:-sahayakai-b4248}"
REGION="${GCP_REGION:-asia-southeast1}"
SERVICE="${SERVICE:-sahayakai-agents}"
echo "[svc-yaml-drift] describing ${SERVICE} (${PROJECT}/${REGION})…"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format=yaml > "$TMP/live.yaml" 2>"$TMP/err" || {
  echo "[svc-yaml-drift] gcloud describe failed:" >&2; cat "$TMP/err" >&2; exit 2
}
fail=0
check() {
  local label="$1"; shift
  local needle="$1"; shift
  if grep -qE "$needle" "$TMP/live.yaml"; then echo "  OK    $label"; else echo "  FAIL  $label (expected: $needle)" >&2; fail=$((fail+1)); fi
}
check "ingress=all"                 'run\.googleapis\.com/ingress: all'
check "SAHAYAKAI_PROMPTS_DIR"       'name: SAHAYAKAI_PROMPTS_DIR'
check "PROMPTS_DIR=/srv/prompts"    'value: /srv/prompts'
check "containerConcurrency=20"     'containerConcurrency: 20'
check "timeoutSeconds=120"          'timeoutSeconds: 120'
check "runtime SA"                  'serviceAccountName: sahayakai-agents-runtime@'
check "audience secret"             'name: SAHAYAKAI_AGENTS_AUDIENCE'
check "signing key secret"          'name: SAHAYAKAI_REQUEST_SIGNING_KEY'
check "GENAI key secret"            'name: GOOGLE_GENAI_API_KEY'
if grep -qE 'name: SAHAYAKAI_REQUIRE_APP_CHECK' "$TMP/live.yaml"; then
  if grep -A1 'SAHAYAKAI_REQUIRE_APP_CHECK' "$TMP/live.yaml" | grep -qE "value: ['\"]?true['\"]?"; then
    echo "  OK    SAHAYAKAI_REQUIRE_APP_CHECK=true"
  else
    echo "  WARN  SAHAYAKAI_REQUIRE_APP_CHECK is not 'true' — eventually must be enforced" >&2
  fi
fi
if [ "$fail" -gt 0 ]; then echo "[svc-yaml-drift] FAIL — ${fail} drifts on ${SERVICE}." >&2; exit 1; fi
echo "[svc-yaml-drift] PASS — ${SERVICE} matches spec."
