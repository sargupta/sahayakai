#!/usr/bin/env bash
# F8-04 — Gather POST is not idempotent
# Send the same SpeechResult twice from the same CallSid; verify transcript
# grows by 4 turns (2 parent + 2 agent) rather than 2.
set -euo pipefail

: "${PREVIEW_URL:?set PREVIEW_URL}"
: "${OUTREACH_ID:?set OUTREACH_ID}"
: "${CALL_SID:?set CALL_SID}"
: "${TWILIO_AUTH_TOKEN:?need token to sign}"

URL="${PREVIEW_URL}/api/attendance/twiml?outreachId=${OUTREACH_ID}"
SPEECH="My child was sick yesterday"

# Twilio HMAC: URL + concat(sortedKey + value)
# Params: CallSid, SpeechResult
SIGN_DATA="${URL}CallSid${CALL_SID}SpeechResult${SPEECH}"
SIG=$(printf "%s" "${SIGN_DATA}" | openssl dgst -sha1 -hmac "${TWILIO_AUTH_TOKEN}" -binary | base64)

BODY="CallSid=${CALL_SID}&SpeechResult=$(printf %s "$SPEECH" | jq -sRr @uri)"

echo "=== Pre-state: fetch transcript length ==="
LEN_BEFORE=$(curl -sS "${PREVIEW_URL}/api/attendance/call-summary?outreachId=${OUTREACH_ID}" \
  -H "Authorization: Bearer ${ID_TOKEN:-}" | jq '.transcript | length')
echo "transcript.length BEFORE = ${LEN_BEFORE}"

echo "=== Send 1st Gather POST ==="
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST "${URL}" \
  -H "X-Twilio-Signature: ${SIG}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "${BODY}"

sleep 2

echo "=== Send 2nd (replay) Gather POST — same SpeechResult ==="
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST "${URL}" \
  -H "X-Twilio-Signature: ${SIG}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "${BODY}"

sleep 2

LEN_AFTER=$(curl -sS "${PREVIEW_URL}/api/attendance/call-summary?outreachId=${OUTREACH_ID}" \
  -H "Authorization: Bearer ${ID_TOKEN:-}" | jq '.transcript | length')
echo "transcript.length AFTER  = ${LEN_AFTER}"

DELTA=$((LEN_AFTER - LEN_BEFORE))
echo "delta = ${DELTA}"
echo "PASS = delta of 2 (dedup'd). FAIL (bug) = delta of 4."
