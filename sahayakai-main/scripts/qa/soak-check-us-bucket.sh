#!/bin/bash
#
# soak-check-us-bucket.sh
#
# Phase B (Mumbai storage migration) — US bucket soak verifier.
#
# After the media bucket was cut over from US (us-central1) to
# sahayakai-b4248-mumbai (asia-south1), the OLD US bucket
# `sahayakai-b4248.firebasestorage.app` is kept read-alive as a
# fallback for a 30-day soak. It MUST NOT be deleted until this check
# reports a clean window: zero NEW writes to US and no meaningful app
# reads beyond migration/verification tooling.
#
# Run this any time during the soak, and as the final gate on day 30
# (2026-07-10) before deleting the US bucket.
#
#   bash scripts/qa/soak-check-us-bucket.sh
#
# Exit 0 = clean (safe to proceed toward deletion at day 30).
# Exit 1 = divergence or unexpected traffic — DO NOT delete, investigate.
#
# Zero-data-loss invariant: a non-empty "post-cutover writes" list means
# something is still writing to US. Deleting then would lose those
# objects. Reverse-delta-copy them to Mumbai first (see runbook §5.5
# rollback/forward-copy procedure), rewrite any Firestore URLs, re-run.

set -euo pipefail

US_BUCKET="sahayakai-b4248.firebasestorage.app"
MUMBAI_BUCKET="sahayakai-b4248-mumbai"
PROJECT="sahayakai-b4248"
# Cutover boundary: last genuine pre-cutover app write to US was
# 2026-06-09T17:17:37Z. Anything strictly after 18:00Z is post-cutover.
CUTOVER_BOUNDARY="2026-06-09T18:00:00Z"

echo "========================================================"
echo " Phase B US-bucket soak check"
echo " US (old):     gs://$US_BUCKET"
echo " Mumbai (new): gs://$MUMBAI_BUCKET"
echo " Cutover boundary: $CUTOVER_BOUNDARY"
echo " Run at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "========================================================"

FAIL=0

# 1. Object-count parity (Mumbai must have at least as many as US).
US_COUNT=$(gcloud storage ls --recursive "gs://$US_BUCKET/**" 2>/dev/null | grep -vE '/$' | wc -l | tr -d ' ')
MUM_COUNT=$(gcloud storage ls --recursive "gs://$MUMBAI_BUCKET/**" 2>/dev/null | grep -vE '/$' | wc -l | tr -d ' ')
echo ""
echo "[1] Object parity:  US=$US_COUNT  Mumbai=$MUM_COUNT"
if [ "$MUM_COUNT" -lt "$US_COUNT" ]; then
  echo "    FAIL: Mumbai has fewer objects than US — Mumbai is missing data."
  FAIL=1
else
  echo "    OK: Mumbai >= US."
fi

# 2. Post-cutover writes to US (the data-loss tripwire).
echo ""
echo "[2] Post-cutover writes to US (must be empty):"
POST=$(gcloud storage ls --recursive --long "gs://$US_BUCKET/**" 2>/dev/null \
  | grep -vE '/$|TOTAL' \
  | awk -v b="$CUTOVER_BOUNDARY" '$2 > b' || true)
if [ -n "$POST" ]; then
  echo "$POST" | head -20
  echo "    FAIL: US received writes after cutover — reverse-copy to Mumbai before deleting."
  FAIL=1
else
  echo "    OK: zero objects written to US after the cutover boundary."
fi

# 3. Last 24h request breakdown on US (informational — flags live app reads).
echo ""
echo "[3] US request_count, last 24h (RewriteObject/ListObjects = migration tooling, ignore):"
TOKEN=$(gcloud auth print-access-token 2>/dev/null)
END=$(date -u +%Y-%m-%dT%H:%M:%SZ)
START=$(date -u -v-24H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)
FILTER="metric.type=\"storage.googleapis.com/api/request_count\" AND resource.labels.bucket_name=\"$US_BUCKET\""
ENC=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$FILTER")
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://monitoring.googleapis.com/v3/projects/$PROJECT/timeSeries?filter=$ENC&interval.startTime=$START&interval.endTime=$END&aggregation.alignmentPeriod=86400s&aggregation.perSeriesAligner=ALIGN_SUM" \
  | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
except Exception:
    print('    (monitoring query returned no parseable data)'); sys.exit(0)
ts=d.get('timeSeries',[])
if not ts:
    print('    (no request activity)'); sys.exit(0)
for s in sorted(ts, key=lambda s:-sum(int(p['value'].get('int64Value',0)) for p in s['points'])):
    m=s['metric']['labels'].get('method','?'); rc=s['metric']['labels'].get('response_code','?')
    t=sum(int(p['value'].get('int64Value',0)) for p in s['points'])
    print(f'      {m:28s} {rc:12s} {t}')
" || echo "    (monitoring unavailable — non-fatal)"

echo ""
echo "========================================================"
if [ "$FAIL" -eq 0 ]; then
  echo " VERDICT: CLEAN. No divergence. Safe to continue soak."
  echo "          On/after 2026-07-10, US bucket may be deleted."
  exit 0
else
  echo " VERDICT: NOT CLEAN. Do NOT delete US bucket. Investigate above."
  exit 1
fi
