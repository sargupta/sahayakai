#!/usr/bin/env bash
# F8-03 — Call summary regenerated on Twilio status retry
# Prereq: an outreach in Firestore where transcript.length > 1 and callSummary is null.
# Hit /twiml-status with status=completed twice and check Firestore for two
# different callSummary.generatedAt timestamps (= LLM ran twice).
set -euo pipefail

: "${PREVIEW_URL:?set PREVIEW_URL}"
: "${CALL_SID:?set CALL_SID matching the outreach}"
: "${TWILIO_AUTH_TOKEN:?need token to sign}"

URL="${PREVIEW_URL}/api/attendance/twiml-status"

# Build params (alphabetically sorted for HMAC)
BODY="CallDuration=42&CallSid=${CALL_SID}&CallStatus=completed"

# Twilio HMAC: URL + concat(sortedKey + value)
SIGN_DATA="${URL}CallDuration42CallSid${CALL_SID}CallStatuscompleted"
SIG=$(printf "%s" "${SIGN_DATA}" | openssl dgst -sha1 -hmac "${TWILIO_AUTH_TOKEN}" -binary | base64)

echo "=== Sending 1st status callback ==="
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST "${URL}" \
  -H "X-Twilio-Signature: ${SIG}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "${BODY}"

echo "Waiting 5s for async summary generation..."
sleep 5

echo "=== Sending 2nd (replay) status callback ==="
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST "${URL}" \
  -H "X-Twilio-Signature: ${SIG}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "${BODY}"

echo
echo "Now check Firestore parent_outreach/<id>.callSummary.generatedAt."
echo "PASS  = single generatedAt timestamp."
echo "FAIL  = generatedAt updated by 2nd call (LLM re-ran)."
