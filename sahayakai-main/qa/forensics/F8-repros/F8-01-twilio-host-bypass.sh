#!/usr/bin/env bash
# F8-01 — Twilio signature bypass via Host header
# Hits /api/attendance/twiml-status with a forged Host: localhost.* header
# and a junk signature. Expectation: 403. Bug present if 200.
set -euo pipefail

: "${PREVIEW_URL:?set PREVIEW_URL e.g. https://sahayakai-hotfix-resilience-XXX.run.app}"
: "${OUTREACH_ID:?set OUTREACH_ID for a seeded test outreach}"

# Strip scheme so we can override Host:
TARGET_HOST="${PREVIEW_URL#https://}"

echo "=== Without spoof (should 403) ==="
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST "${PREVIEW_URL}/api/attendance/twiml-status" \
  -H "X-Twilio-Signature: deadbeef" \
  -d "CallSid=CA-test&CallStatus=completed"

echo "=== With Host: localhost.attacker.example (BUG = 200) ==="
curl -sS -o /tmp/F8-01.body -w "%{http_code}\n" \
  -X POST "https://${TARGET_HOST}/api/attendance/twiml-status" \
  -H "Host: localhost.attacker.example" \
  -H "X-Twilio-Signature: deadbeef" \
  -d "CallSid=CA-test&CallStatus=completed"

echo "Body:"
cat /tmp/F8-01.body || true
echo
echo "PASS = 403 on second call. FAIL (bug present) = 200."
