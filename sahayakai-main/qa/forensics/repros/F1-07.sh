#!/usr/bin/env bash
# F1-07 — ai-reactive-reply fail-open. With AI_INTERNAL_SECRET unset, any anon caller is admitted.
# 400 here means request passed auth and was rejected only on payload validation (path allowlist).
set -euo pipefail
PROD=https://sahayakai-hotfix-resilience-zwydpvyuca-as.a.run.app
curl -sS -X POST "$PROD/api/jobs/ai-reactive-reply" \
  -H 'content-type: application/json' \
  -d '{"collectionPath":"community_chat","messageText":"probe","authorName":"forensic"}' \
  -w '\nHTTP %{http_code}\n'
# If gate were working (and secret unset → must fail-closed), expected 403. Actual: 400 (admitted).
