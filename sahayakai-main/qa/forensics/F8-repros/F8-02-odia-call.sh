#!/usr/bin/env bash
# F8-02 — Odia parent call always renders English TwiML
# Prereq: seed a parent_outreach doc with parentLanguage:"Odia",
# generatedMessage:"ନମସ୍କାର ..." and capture its id as OUTREACH_ID.
set -euo pipefail

: "${PREVIEW_URL:?set PREVIEW_URL}"
: "${OUTREACH_ID:?set OUTREACH_ID for an Odia outreach}"
: "${TWILIO_AUTH_TOKEN:?need token to sign}"

URL="${PREVIEW_URL}/api/attendance/twiml?outreachId=${OUTREACH_ID}"

# HMAC the URL with empty body (GET) — base64(HMAC-SHA1(token, URL))
SIG=$(printf "%s" "${URL}" | openssl dgst -sha1 -hmac "${TWILIO_AUTH_TOKEN}" -binary | base64)

echo "Hitting GET ${URL}"
curl -sS "${URL}" \
  -H "X-Twilio-Signature: ${SIG}" \
  -o /tmp/F8-02.xml

echo "--- Response ---"
cat /tmp/F8-02.xml
echo
echo

if grep -q 'language="or-IN"\|language="od-IN"' /tmp/F8-02.xml; then
  echo "PASS — Odia voice path active"
else
  echo "FAIL — bug confirmed: TwiML uses en-IN language tag for an Odia outreach"
fi
