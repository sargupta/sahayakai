#!/usr/bin/env bash
# F1-02 — anon POST to /api/jobs/grow-persona-pool creates AI persona users in prod
# Expected: 401/503. Actual (2026-06-06): 200 with created/skipped persona list.
set -euo pipefail
PROD=https://sahayakai-hotfix-resilience-zwydpvyuca-as.a.run.app
curl -sS -X POST "$PROD/api/jobs/grow-persona-pool" \
  -H 'content-type: application/json' \
  -d '{}' \
  -w '\nHTTP %{http_code}\n'
