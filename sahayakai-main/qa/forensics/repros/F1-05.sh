#!/usr/bin/env bash
# F1-05 — CRON_SECRET unset in prod. billing-reconciliation returns 500 instead of 401.
set -euo pipefail
PROD=https://sahayakai-hotfix-resilience-zwydpvyuca-as.a.run.app
curl -sS -X POST "$PROD/api/jobs/billing-reconciliation" \
  -H 'content-type: application/json' \
  -d '{}' \
  -w '\nHTTP %{http_code}\n'
# Expected when CRON_SECRET is bound:    401 {"error":"Unauthorized"}
# Actual (anon, no env var bound):      500 {"error":"CRON_SECRET not configured"}
