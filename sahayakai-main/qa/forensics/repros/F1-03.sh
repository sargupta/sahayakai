#!/usr/bin/env bash
# F1-03 — anon POST to /api/jobs/ai-community-agent posts AI-persona content in prod
# Expected: 401/503. Actual (2026-06-06): 200 with real Firestore writes to community surfaces.
set -euo pipefail
PROD=https://sahayakai-hotfix-resilience-zwydpvyuca-as.a.run.app
curl -sS -X POST "$PROD/api/jobs/ai-community-agent" \
  -H 'content-type: application/json' \
  -d '{}' \
  -w '\nHTTP %{http_code}\n'
