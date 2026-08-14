#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Post-deploy smoke test for SahayakAI
# (Cloud Run, dual-region: asia-southeast1 Singapore + asia-south1 Mumbai)
# Run AFTER a deploy — Cloud Run takes ~90s to roll out.
#
# Usage:
#   bash scripts/smoke-test.sh                  # tests production
#   BASE=http://localhost:3000 bash scripts/smoke-test.sh  # tests locally
#   REQUIRE_ENV=0 BASE=<uat-url> bash scripts/smoke-test.sh
#     # UAT / tagged revisions: skip the env-var completeness gate (UAT
#     # intentionally omits prod-only env vars and secrets).
#
# COVERAGE GAP (S6): the Twilio / parent-call path is NEVER exercised here —
# verifying it needs real Twilio credentials and places a real call. A green
# smoke says nothing about voice calling. After releases that touch the
# call stack, verify a real parent call manually (see
# docs/PARENT_CALL_RUNBOOK if present, or qa/ scripts).
# ────────────────────────────────────────────────────────────────────────────

# Default to www: the apex answers page routes with 308 → www (curl here
# does not follow redirects, deliberately — a redirect is not a rendered
# page). Recent green runs are all against www.
BASE="${BASE:-https://www.sahayakai.com}"
WAIT_SECS="${WAIT_SECS:-90}"
REQUIRE_ENV="${REQUIRE_ENV:-1}"
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

# POST variant — for routes that only accept POST. Sends an empty JSON body
# and asserts EITHER (a) status matches expected_status, OR (b) status
# matches AND body contains expected_body_substring. The body assertion
# is critical for "route exists, validation rejected" checks where status
# alone can lie: if validation tightens (rejecting empty), 400 stays;
# if it loosens (accepting {}), 200 comes back. A body assertion locks
# in the contract: "this is the validation error we expect."
#
# Args:
#   $1 label
#   $2 url
#   $3 expected_status (default 401)
#   $4 expected_body_substring (optional — if set, body must contain it)
check_post() {
  local label="$1"
  local url="$2"
  local expected_status="${3:-401}"
  local expected_body_substring="${4:-}"

  local status
  status=$(curl -s -o /tmp/smoke_body -w "%{http_code}" \
    --max-time 15 \
    --request POST \
    --header "Content-Type: application/json" \
    --header "User-Agent: SahayakAI-SmokeTest/1.0" \
    --data '{}' \
    "$url")

  if [[ "$status" != "$expected_status" ]]; then
    echo "  FAIL  [$status] $label  (expected $expected_status)"
    echo "        URL: $url (POST)"
    head -c 200 /tmp/smoke_body 2>/dev/null | tr -d '\n'
    echo ""
    FAIL=1
    return
  fi

  if [[ -n "$expected_body_substring" ]]; then
    if ! grep -qF "$expected_body_substring" /tmp/smoke_body 2>/dev/null; then
      echo "  FAIL  [$status] $label  (body missing substring: '$expected_body_substring')"
      echo "        URL: $url (POST)"
      head -c 200 /tmp/smoke_body 2>/dev/null | tr -d '\n'
      echo ""
      FAIL=1
      return
    fi
  fi

  echo "  PASS  [$status] $label"
}

# ── Health check — validates env vars are present ───────────────────────────
echo ""
echo "--- Health ---"
check "API health"          "$BASE/api/health"

# Parse health response to check env vars. REQUIRE_ENV=0 downgrades a
# failure to a warning — UAT / preview services intentionally omit
# prod-only env vars and secrets, so completeness is advisory there.
#
# The payload shape depends on auth (the health route is auth-gated since
# 0c14582d1 — unauthenticated callers do not get the full checks object).
# Parse, in order of preference:
#   1. checks.environment.healthy — full diagnostic payload (authed / local)
#   2. envOk                      — coarse boolean exposed to unauthenticated
#                                   callers (added 2026-08-14)
#   3. top-level status == "ok"   — pre-envOk unauthenticated shape; the
#                                   route folds environment.healthy into the
#                                   200-vs-503 + ok-vs-unhealthy decision,
#                                   so this is a valid coarse env signal on
#                                   revisions that predate envOk.
health_body=$(curl -s --max-time 10 "$BASE/api/health")
env_healthy=$(echo "$health_body" | python3 -c "
import json, sys
d = json.load(sys.stdin)
env = d.get('checks', {}).get('environment', {})
if 'healthy' in env:
    print(env['healthy'])
elif 'envOk' in d:
    print(d['envOk'])
else:
    print(d.get('status') == 'ok')
" 2>/dev/null)
missing=$(echo "$health_body" | python3 -c "import json,sys; d=json.load(sys.stdin); missing=d.get('checks',{}).get('environment',{}).get('missingVars',[]); print(', '.join(missing) if missing else '(no detail — unauthenticated caller gets coarse signal only)')" 2>/dev/null)

if [[ "$env_healthy" == "True" ]]; then
  echo "  PASS  [env]  All required env vars present"
elif [[ "$REQUIRE_ENV" == "0" ]]; then
  echo "  WARN  [env]  Missing env vars (not gating, REQUIRE_ENV=0): $missing"
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
check "My Library"          "$BASE/my-library"
check "Community Library"   "$BASE/community-library"
check "Community"           "$BASE/community"
# visual-aid-creator was deleted in eb612c4a9 (stub removed); the surviving
# surface is visual-aid-designer only.
check "Visual Aid Designer" "$BASE/visual-aid-designer"

# ── API routes ──────────────────────────────────────────────────────────────
# These routes accept POST only and reject empty-body requests with 400
# (Bad Request). 400 confirms the route exists and the handler ran. Both
# moved from public-GET to validated-POST in the develop catch-up
# (release-2026-05-21) — smoke test was previously testing GET 200 and
# silently failing for weeks.
echo ""
echo "--- API Routes ---"
# teacher-activity now auth-gates BEFORE validation (x-user-id check →
# 401 Unauthorized on anonymous POST). 401 + "Unauthorized" still proves
# "route exists, gate ran" — the previous 400 "Invalid events format"
# expectation predates the auth gate and was failing against prod.
check_post "Teacher Activity (unauth)"      "$BASE/api/teacher-activity"  "401"  "Unauthorized"
check_post "Metrics (empty body)"           "$BASE/api/metrics"           "400"  "Invalid metrics format"

# ── Security — confirm /admin and AI POST routes require auth ───────────────
echo ""
echo "--- Security ---"
check "Admin blocked (no auth)" "$BASE/admin/log-dashboard" "401"
check_post "Assessment Scanner blocked (no auth)" "$BASE/api/ai/assessment-scanner" "401"

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "All smoke tests passed. Production looks healthy."
else
  echo "SMOKE TEST FAILED — check Cloud Run logs:"
  echo "  gcloud logging read 'resource.type=\"cloud_run_revision\"' --limit=20 --format=json --project=sahayakai-b4248"
  exit 1
fi
