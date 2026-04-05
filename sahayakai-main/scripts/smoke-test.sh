#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Post-deploy smoke test for SahayakAI (Cloud Run, asia-south1)
# Run AFTER git push origin main — Cloud Run takes ~90s to roll out.
#
# Usage:
#   bash scripts/smoke-test.sh                  # tests production
#   BASE=http://localhost:3000 bash scripts/smoke-test.sh  # tests locally
# ────────────────────────────────────────────────────────────────────────────

BASE="${BASE:-https://sahayakai.com}"
WAIT_SECS="${WAIT_SECS:-90}"
FAIL=0

echo "Smoke test → $BASE"

# ── Wait for Cloud Run to finish rolling out ────────────────────────────────
if [[ "$WAIT_SECS" -gt 0 ]]; then
  echo "Waiting ${WAIT_SECS}s for Cloud Run rollout..."
  sleep "$WAIT_SECS"
fi

# ── Helper ──────────────────────────────────────────────────────────────────
check() {
  local label="$1"
  local url="$2"
  local expected_status="${3:-200}"

  local status
  status=$(curl -s -o /tmp/smoke_body -w "%{http_code}" \
    --max-time 15 \
    --header "User-Agent: SahayakAI-SmokeTest/1.0" \
    "$url")

  if [[ "$status" == "$expected_status" ]]; then
    echo "  PASS  [$status] $label"
  else
    echo "  FAIL  [$status] $label  (expected $expected_status)"
    echo "        URL: $url"
    # Show first 200 chars of body for debugging
    head -c 200 /tmp/smoke_body 2>/dev/null | tr -d '\n'
    echo ""
    FAIL=1
  fi
}

# ── Health check — validates env vars are present ───────────────────────────
echo ""
echo "--- Health ---"
check "API health"          "$BASE/api/health"

# Parse health response to check env vars
health_body=$(curl -s --max-time 10 "$BASE/api/health")
env_healthy=$(echo "$health_body" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('checks',{}).get('environment',{}).get('healthy', False))" 2>/dev/null)
missing=$(echo "$health_body" | python3 -c "import json,sys; d=json.load(sys.stdin); missing=d.get('checks',{}).get('environment',{}).get('missingVars',[]); print(', '.join(missing) if missing else 'none')" 2>/dev/null)

if [[ "$env_healthy" == "True" ]]; then
  echo "  PASS  [env]  All required env vars present"
else
  echo "  FAIL  [env]  Missing env vars: $missing"
  FAIL=1
fi

# ── Page routes — verify server renders without crashing ────────────────────
echo ""
echo "--- Page Routes ---"
check "Home"                "$BASE/"
check "Lesson Plan"         "$BASE/lesson-plan"
check "Attendance"          "$BASE/attendance"
check "Library"             "$BASE/library"
check "Community"           "$BASE/community"
check "Visual Aid"          "$BASE/visual-aid"

# ── API routes (public) ─────────────────────────────────────────────────────
echo ""
echo "--- API Routes ---"
check "Teacher Activity"    "$BASE/api/teacher-activity"  # public — no auth needed
check "Metrics"             "$BASE/api/metrics"            # public

# ── Security — confirm /admin requires auth ──────────────────────────────────
echo ""
echo "--- Security ---"
check "Admin blocked (no auth)" "$BASE/admin/log-dashboard" "401"

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "All smoke tests passed. Production looks healthy."
else
  echo "SMOKE TEST FAILED — check Cloud Run logs:"
  echo "  gcloud logging read 'resource.type=\"cloud_run_revision\"' --limit=20 --format=json --project=sahayakai-b4248"
  exit 1
fi
