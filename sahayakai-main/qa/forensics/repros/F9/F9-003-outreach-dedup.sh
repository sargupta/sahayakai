#!/usr/bin/env bash
# F9-003 — No outreach dedup/cooldown.
# Fires 3 identical outreach POSTs within 5 seconds. Expected (bug): all 3
# return 200 with distinct outreachIds. Expected (after fix): #2 and #3
# return 429 with "Outreach cooldown".

set -euo pipefail
: "${BASE:?}"; : "${TOKEN:?}"; : "${CLASS_ID:?}"; : "${STUDENT_ID:?}"

body() {
  cat <<EOF
{
  "classId":"$CLASS_ID","className":"5A",
  "studentId":"$STUDENT_ID","studentName":"Test Student",
  "parentPhone":"+919876543210","parentLanguage":"Hindi",
  "reason":"consecutive_absences",
  "generatedMessage":"hello","deliveryMethod":"twilio_call"
}
EOF
}

for i in 1 2 3; do
  echo "[$i] POST"
  curl -sS -o /tmp/resp -w 'HTTP %{http_code}\n' -X POST "$BASE/api/attendance/outreach" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d "$(body)"
  cat /tmp/resp
  echo
done

echo "Expected after fix: #1=200, #2=429, #3=429"
