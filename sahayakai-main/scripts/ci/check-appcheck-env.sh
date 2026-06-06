#!/usr/bin/env bash
# Warn (or fail with MODE=strict) when SAHAYAKAI_REQUIRE_APP_CHECK=false.
set -euo pipefail
PROJECT="${GCP_PROJECT:-sahayakai-b4248}"
REGION="${GCP_REGION:-asia-southeast1}"
MODE="${MODE:-warn}"
services=("sahayakai-agents" "sahayakai-agents-staging")
fail=0
for svc in "${services[@]}"; do
  echo "[appcheck] describing ${svc}…"
  value=$(gcloud run services describe "$svc" --project="$PROJECT" --region="$REGION" \
    --format='value(spec.template.spec.containers[0].env.filter("name:SAHAYAKAI_REQUIRE_APP_CHECK").extract(value).flatten())' 2>/dev/null || echo "")
  if [ -z "$value" ]; then
    echo "  WARN  ${svc}: SAHAYAKAI_REQUIRE_APP_CHECK not set"
    [ "$MODE" = "strict" ] && fail=$((fail+1))
  elif [ "$value" = "true" ]; then
    echo "  OK    ${svc}: SAHAYAKAI_REQUIRE_APP_CHECK=true"
  else
    echo "  WARN  ${svc}: SAHAYAKAI_REQUIRE_APP_CHECK=${value}"
    [ "$MODE" = "strict" ] && fail=$((fail+1))
  fi
done
if [ "$fail" -gt 0 ]; then echo "[appcheck] STRICT mode: ${fail} service(s) failed." >&2; exit 1; fi
echo "[appcheck] done (mode=${MODE})."
