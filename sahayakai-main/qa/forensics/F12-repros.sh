#!/usr/bin/env bash
# F12 cron-jobs forensic repros
# Usage:
#   export HOST="https://sahayakai-hotfix-resilience-<hash>-as.a.run.app"
#   export CRON_SECRET="<from gcloud secrets>"
#   export AI_INTERNAL_SECRET="<from gcloud secrets>"
#   bash qa/forensics/F12-repros.sh

set -u
HOST="${HOST:?set HOST}"
CRON_SECRET="${CRON_SECRET:-}"
AI_INTERNAL_SECRET="${AI_INTERNAL_SECRET:-}"

pass() { echo "  PASS — $1"; }
fail() { echo "  FAIL — $1"; }
hdr()  { echo; echo "── $1 ──"; }

# ── F12-P0-01: storage-cleanup unauth + arbitrary path ────────────────────────
hdr "F12-P0-01  storage-cleanup unauth"
code=$(curl -s -o /tmp/sc.json -w "%{http_code}" -X POST "$HOST/api/jobs/storage-cleanup" \
  -H 'Content-Type: application/json' \
  -d '{"storagePath":"_forensic_probe_does_not_exist.bin","userId":"probe","contentId":"probe"}')
echo "    status=$code body=$(cat /tmp/sc.json)"
if [ "$code" = "401" ] || [ "$code" = "403" ]; then pass "auth gate in place"; else fail "no auth — accepts arbitrary delete (P0)"; fi

# ── F12-P1-02: ai-reactive-reply env-unset bypass ─────────────────────────────
hdr "F12-P1-02  ai-reactive-reply without x-internal-secret"
code=$(curl -s -o /tmp/rr.json -w "%{http_code}" -X POST "$HOST/api/jobs/ai-reactive-reply" \
  -H 'Content-Type: application/json' \
  -d '{"collectionPath":"community_chat","messageText":"hi","authorName":"Forensic Probe"}')
echo "    status=$code body=$(cat /tmp/rr.json)"
if [ "$code" = "403" ] || [ "$code" = "503" ]; then pass "secret gate in place"; else fail "open when env unset (P1)"; fi

# ── F12-P1-04: export-reminder ─────────────────────────────────────────────────
hdr "F12-P1-04  export-reminder unauth"
code=$(curl -s -o /tmp/er.json -w "%{http_code}" -X POST "$HOST/api/jobs/export-reminder")
echo "    status=$code body=$(cat /tmp/er.json)"
if [ "$code" = "401" ] || [ "$code" = "503" ]; then pass "auth gate in place"; else fail "open in non-prod (P1)"; fi

# ── Auth matrix — POST without bearer ─────────────────────────────────────────
hdr "Auth matrix (unauth POST → expect 401, not 500)"
for route in daily-briefing edu-news ai-community-agent billing-reconciliation \
             community-chat-cleanup grow-persona-pool; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$HOST/api/jobs/$route" \
    -H 'Content-Type: application/json' -d '{}')
  if [ "$code" = "401" ]; then pass "$route → 401"; else fail "$route → $code"; fi
done

# ── F12-P1-08: AI cooldown bypass via field-name mismatch ─────────────────────
if [ -n "$CRON_SECRET" ] && [ -n "$AI_INTERNAL_SECRET" ]; then
  hdr "F12-P1-08  cooldown bypass (manual test)"
  echo "    1) Triggering ai-community-agent (writes 'timestamp' field)..."
  curl -s -X POST "$HOST/api/jobs/ai-community-agent" \
    -H "Authorization: Bearer $CRON_SECRET" -o /dev/null -w "    status=%{http_code}\n"
  sleep 2
  echo "    2) Triggering ai-reactive-reply with a simulated real-teacher message..."
  curl -s -X POST "$HOST/api/jobs/ai-reactive-reply" \
    -H "x-internal-secret: $AI_INTERNAL_SECRET" \
    -H 'Content-Type: application/json' \
    -d '{"collectionPath":"community_chat","messageText":"forensic probe","authorName":"Real Teacher Probe"}' \
    -o /tmp/rr2.json -w "    status=%{http_code}\n"
  echo "    body=$(cat /tmp/rr2.json)"
  echo "    EXPECT (post-fix): {\"action\":\"skipped\",\"reason\":\"cooldown\"} — current behaviour: ~30% post"
fi

# ── F12-P2-10: billing-reconciliation parallel runs ───────────────────────────
if [ -n "$CRON_SECRET" ]; then
  hdr "F12-P2-10  parallel reconciliation runs (manual)"
  echo "    NOT auto-run — could mutate user plans. Manual procedure:"
  echo "    Tab A: curl -X POST $HOST/api/jobs/billing-reconciliation -H 'Authorization: Bearer \$CRON_SECRET'"
  echo "    Tab B: same, simultaneously"
  echo "    Expected: one run, one mutex-rejected. Current: two runIds, double auto-fix."
fi

echo
echo "Done. See qa/forensics/F12-cron-jobs.md for full report."
