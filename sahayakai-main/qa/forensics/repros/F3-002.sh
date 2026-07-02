#!/usr/bin/env bash
# F3-002 — /api/vidya/profile accepts any object under "profile".
# Preview-only.

set -euo pipefail
: "${BASE_URL:?}"
: "${ID_TOKEN:?}"

curl -sS -X POST "$BASE_URL/api/vidya/profile" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"profile":{"unallowlistedKey":"<REDACTED>","somePrivilegedFlag":true}}' \
  -w '\nHTTP %{http_code}\n'

# Verify in Firestore: users/{uid}.jarvis.unallowlistedKey should NOT exist after fix.
