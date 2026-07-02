#!/usr/bin/env bash
# F1-01 — anon POST to /api/jobs/daily-briefing executes full LLM + Firestore-write workload in prod
# Expected (correctly secured): HTTP 401 or 503
# Actual (2026-06-06):          HTTP 200 with {"ok":true,"posted":3,...}
set -euo pipefail
PROD=https://sahayakai-hotfix-resilience-zwydpvyuca-as.a.run.app
curl -sS -X POST "$PROD/api/jobs/daily-briefing" \
  -H 'content-type: application/json' \
  -d '{}' \
  -w '\nHTTP %{http_code}\n'
