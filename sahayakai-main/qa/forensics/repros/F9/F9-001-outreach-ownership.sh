#!/usr/bin/env bash
# F9-001 — Outreach POST lacks class/student ownership check.
#
# PRECONDITIONS:
#   - Two pro test users seeded: forensic-att-A (victim) and forensic-att-B (attacker).
#   - Victim A has created a class (CLASS_ID_A) with a student (STUDENT_ID_A).
#   - Both users have valid Firebase ID tokens via gcloud impersonation:
#       TOKEN_A=$(gcloud auth print-identity-token --impersonate-service-account=forensic-att-A@...)
#       TOKEN_B=$(gcloud auth print-identity-token --impersonate-service-account=forensic-att-B@...)
#   - BASE=http://localhost:3000 (or staging URL).
#
# EXPECTED (bug present): the POST returns 200 with an outreachId, and the
# outreach record is written with attacker-controlled phone + victim student.
# A subsequent call POST will dial the attacker-supplied number.
#
# EXPECTED (after fix): the POST returns 403 because user B does not own CLASS_ID_A.

set -euo pipefail

: "${BASE:?must set BASE}"
: "${TOKEN_B:?must set TOKEN_B (attacker token)}"
: "${CLASS_ID_A:?must set CLASS_ID_A (victim's class)}"
: "${STUDENT_ID_A:?must set STUDENT_ID_A (victim's student)}"
ATTACKER_PHONE="${ATTACKER_PHONE:-+919999999999}"

echo "[F9-001] POSTing outreach as user B against user A's student…"
RESP=$(curl -sS -w '\n%{http_code}' -X POST "$BASE/api/attendance/outreach" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H 'Content-Type: application/json' \
  -d "{
    \"classId\":\"$CLASS_ID_A\",
    \"className\":\"Hijacked Class\",
    \"studentId\":\"$STUDENT_ID_A\",
    \"studentName\":\"Victim Student\",
    \"parentPhone\":\"$ATTACKER_PHONE\",
    \"parentLanguage\":\"Hindi\",
    \"reason\":\"consecutive_absences\",
    \"generatedMessage\":\"hijack test\",
    \"deliveryMethod\":\"twilio_call\"
  }")
BODY=$(echo "$RESP" | sed '$d')
CODE=$(echo "$RESP" | tail -n1)

echo "HTTP $CODE"
echo "$BODY"

if [ "$CODE" = "200" ]; then
  echo "[F9-001] BUG REPRODUCED — outreach created cross-tenant. P0."
  exit 1
elif [ "$CODE" = "403" ]; then
  echo "[F9-001] PASS — outreach correctly rejected."
  exit 0
else
  echo "[F9-001] UNEXPECTED status $CODE"
  exit 2
fi
