#!/usr/bin/env bash
# F3-004 — /api/jobs/ai-reactive-reply auth bypass when AI_INTERNAL_SECRET is unset.
# DO NOT run against prod. Preview env only, with AI_INTERNAL_SECRET intentionally unset
# to validate the fail-open behaviour described in the finding.

set -euo pipefail
: "${BASE_URL:?}"

# No auth headers — should be rejected if the secret is configured.
# If it's NOT configured, this triggers an AI persona post with 30% probability.
curl -sS -X POST "$BASE_URL/api/jobs/ai-reactive-reply" \
  -H "Content-Type: application/json" \
  --data '{"collectionPath":"<an-allowed-chat-path>","messageText":"<REDACTED>","authorName":"TestUser"}' \
  -w '\nHTTP %{http_code}\n'

# Expected after fix: 503 (or 403) regardless of env-var presence — never 200.
