#!/usr/bin/env bash
# F3-001 — /api/feedback accepts arbitrary body keys.
# RUN ONLY against a preview/staging instance with a throwaway test user.
# This script documents the attack surface; payloads are REDACTED.
#
# Demonstrates: unbounded field-name injection into feedback collection.

set -euo pipefail
: "${BASE_URL:?Set BASE_URL to preview env, e.g. https://preview-xxx.run.app}"
: "${ID_TOKEN:?Set ID_TOKEN to a Firebase ID token for a TEST user}"

# Payload 1: arbitrary key (should be rejected by a schema; today: accepted + persisted)
curl -sS -X POST "$BASE_URL/api/feedback" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"arbitraryKey":"<REDACTED_LARGE_STRING>","anotherKey":12345}' \
  -w '\nHTTP %{http_code}\n'

# Payload 2: literal "__proto__" key (becomes own property on the persisted doc;
# NOT a JS prototype pollution because object spread copies own props only).
curl -sS -X POST "$BASE_URL/api/feedback" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"__proto__":{"isAdmin":true}}' \
  -w '\nHTTP %{http_code}\n'

# Expected after fix: 400 Schema Validation Failed for both.
