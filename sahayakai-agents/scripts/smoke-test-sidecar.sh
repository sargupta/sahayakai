#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Post-deploy smoke test for the sahayakai-agents Cloud Run sidecar.
#
# Hits every public + agent route and tabulates pass / fail / skip.
#
# Usage:
#   BASE_URL=https://sahayakai-agents-xxx.a.run.app \
#     bash scripts/smoke-test-sidecar.sh
#
#   # Local dev (auth bypassed when SAHAYAKAI_AGENTS_ENV=development on the
#   # server — see auth.py):
#   bash scripts/smoke-test-sidecar.sh
#
# Environment variables:
#   BASE_URL                       — sidecar URL (default http://localhost:8080)
#   AUDIENCE                       — token aud claim (default = BASE_URL)
#   INVOKER_SA                     — SA email for impersonation
#                                    (default: pulled from CLAUDE.md /
#                                    sahayakai-hotfix-resilience-runtime@…)
#   SAHAYAKAI_REQUEST_SIGNING_KEY  — HMAC secret (read from Secret Manager
#                                    or env). Required for prod probes.
#   SKIP_AUTH                      — "1" to send unsigned requests (only
#                                    works against a dev-mode server).
#
# What's covered:
#   GET  /healthz
#   GET  /readyz
#   GET  /.well-known/agent.json
#   POST /v1/instant-answer/answer
#   POST /v1/lesson-plan/generate
#   POST /v1/parent-call/reply
#   POST /v1/parent-call/summary
#   POST /v1/vidya/orchestrate
#
# Out-of-scope routes (scaffolded but not yet wired by Phase U / PR #22):
#   visual-aid, quiz, worksheet, exam-paper, rubric, virtual-field-trip,
#   teacher-training, video-storyteller, voice-to-text, parent-message,
#   intent — once those routers register, add them under "AGENT_ROUTES"
#   below and the harness will pick them up.
#
# Exit code: 0 if all checks pass-or-skip, 1 if any FAIL.
# ────────────────────────────────────────────────────────────────────────────

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
BASE_URL="${BASE_URL%/}"
AUDIENCE="${AUDIENCE:-$BASE_URL}"
INVOKER_SA="${INVOKER_SA:-sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com}"
TIMEOUT="${TIMEOUT:-60}"

PASS=0
FAIL=0
SKIP=0
TOTAL_START=$(date +%s)

ID_TOKEN=""
SIGNING_KEY="${SAHAYAKAI_REQUEST_SIGNING_KEY:-}"

# ── Helpers ────────────────────────────────────────────────────────────────
ts_iso() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
now_ms() { python3 -c 'import time; print(int(time.time()*1000))'; }
uuid()   { python3 -c 'import uuid; print(uuid.uuid4())'; }

print_header() {
  printf '=== Sahayakai sidecar smoke test ===\n'
  printf 'Base: %s\n' "$BASE_URL"
  printf 'Audience: %s\n' "$AUDIENCE"
  printf 'Started: %s\n' "$(ts_iso)"
  printf '\n'
  printf '%-40s %-12s %-10s %s\n' "Route" "Status" "Latency" "Notes"
  printf '%-40s %-12s %-10s %s\n' "-----" "------" "-------" "-----"
}

print_row() {
  local route="$1" status="$2" latency_ms="$3" notes="$4" result="$5"
  local mark
  case "$result" in
    PASS) mark=$'\xe2\x9c\x93' ;;
    FAIL) mark=$'\xe2\x9c\x97' ;;
    SKIP) mark="-" ;;
    *)    mark="?" ;;
  esac
  printf '%-40s %s %-10s %-10s %s\n' "$route" "$mark" "$status" "${latency_ms}ms" "$notes"
}

extract_note() {
  local body_file="$1" field="$2"
  python3 - "$body_file" "$field" <<'PYEOF' 2>/dev/null || true
import json, sys, os
path, field = sys.argv[1], sys.argv[2]
try:
    with open(path) as f:
        data = json.load(f)
except Exception:
    sz = os.path.getsize(path)
    print(f"non-json body ({sz}b)")
    sys.exit(0)
if not isinstance(data, dict):
    print(f"top-level: {type(data).__name__}")
    sys.exit(0)
val = data.get(field)
if val is None:
    keys = sorted(data.keys())[:3]
    print(f"keys: {','.join(keys)}")
    sys.exit(0)
if isinstance(val, str):
    snippet = val.strip().replace("\n", " ")
    if len(snippet) > 60:
        snippet = snippet[:57] + "..."
    print(f'{field}: "{snippet}"')
elif isinstance(val, list):
    print(f"{field}: {len(val)} items")
elif isinstance(val, dict):
    print(f"{field}: object with {len(val)} keys")
else:
    print(f"{field}: {val}")
PYEOF
}

error_excerpt() {
  local body_file="$1"
  python3 - "$body_file" <<'PYEOF' 2>/dev/null || head -c 80 "$body_file"
import json, sys
try:
    with open(sys.argv[1]) as f:
        d = json.load(f)
    msg = d.get("error") or d.get("message") or d.get("detail") or str(d)[:80]
    print(str(msg)[:80])
except Exception:
    with open(sys.argv[1]) as f:
        print(f.read(80).strip().replace("\n", " "))
PYEOF
}

# Compute X-Content-Digest = "sha256=" + base64(HMAC-SHA256(key, ts+":"+body))
sign_body() {
  local timestamp="$1" body="$2"
  python3 - "$timestamp" "$body" "$SIGNING_KEY" <<'PYEOF'
import sys, hmac, hashlib, base64
ts, body, key = sys.argv[1], sys.argv[2], sys.argv[3]
mac = hmac.new(key.encode(), ts.encode() + b":" + body.encode(), hashlib.sha256).digest()
print("sha256=" + base64.b64encode(mac).decode())
PYEOF
}

# ── Auth bootstrap ──────────────────────────────────────────────────────────
acquire_id_token() {
  if [[ "${SKIP_AUTH:-0}" == "1" ]]; then
    return 0
  fi
  if ! command -v gcloud >/dev/null 2>&1; then
    printf '! gcloud not on PATH — cannot mint ID token.\n' >&2
    printf '  POST probes will be marked SKIP.\n' >&2
    printf '  To enable: install gcloud, run `gcloud auth login`, and grant\n' >&2
    printf '  iam.serviceAccountTokenCreator on %s.\n' "$INVOKER_SA" >&2
    return 1
  fi
  if ! ID_TOKEN=$(gcloud auth print-identity-token \
        --impersonate-service-account="$INVOKER_SA" \
        --audiences="$AUDIENCE" 2>/dev/null); then
    printf '! gcloud impersonation failed. POST probes will be SKIP.\n' >&2
    printf '  Required: roles/iam.serviceAccountTokenCreator on %s.\n' "$INVOKER_SA" >&2
    return 1
  fi
  return 0
}

# ── GET probe ──────────────────────────────────────────────────────────────
probe_get() {
  local route="$1" path="$2" expected_field="$3"
  local body_file
  body_file="$(mktemp -t sidecar-smoke.XXXXXX)"
  local start_ms end_ms latency_ms status
  start_ms=$(now_ms)
  status=$(curl -s -o "$body_file" -w '%{http_code}' \
    --max-time "$TIMEOUT" \
    "$BASE_URL$path")
  end_ms=$(now_ms)
  latency_ms=$((end_ms - start_ms))

  local notes result
  if [[ "$status" == "200" ]]; then
    notes=$(extract_note "$body_file" "$expected_field")
    [[ -z "$notes" ]] && notes="ok"
    result="PASS"; PASS=$((PASS + 1))
  else
    notes=$(error_excerpt "$body_file")
    result="FAIL"; FAIL=$((FAIL + 1))
  fi
  print_row "$route" "$status" "$latency_ms" "$notes" "$result"
  rm -f "$body_file"
}

# ── POST probe (signed, authed) ─────────────────────────────────────────────
probe_post() {
  local route="$1" path="$2" body="$3" expected_field="$4"

  # If we couldn't mint a token AND we don't have SKIP_AUTH set, skip.
  if [[ -z "$ID_TOKEN" && "${SKIP_AUTH:-0}" != "1" ]]; then
    print_row "$route" "SKIP" "0" "no ID token (see warnings above)" "SKIP"
    SKIP=$((SKIP + 1))
    return
  fi

  # If the server requires HMAC and we don't have a key, skip (only when
  # not in dev/SKIP_AUTH mode — dev server bypasses HMAC entirely).
  if [[ -z "$SIGNING_KEY" && "${SKIP_AUTH:-0}" != "1" ]]; then
    print_row "$route" "SKIP" "0" "no SAHAYAKAI_REQUEST_SIGNING_KEY in env" "SKIP"
    SKIP=$((SKIP + 1))
    return
  fi

  local body_file
  body_file="$(mktemp -t sidecar-smoke.XXXXXX)"
  local timestamp request_id digest
  timestamp=$(now_ms)
  request_id=$(uuid)

  local -a headers
  headers=(-H "Content-Type: application/json" \
           -H "X-Request-ID: $request_id" \
           -H "X-Request-Timestamp: $timestamp")

  if [[ "${SKIP_AUTH:-0}" != "1" ]]; then
    digest=$(sign_body "$timestamp" "$body")
    headers+=(-H "Authorization: Bearer $ID_TOKEN" \
              -H "X-Content-Digest: $digest")
  fi

  local start_ms end_ms latency_ms status
  start_ms=$(now_ms)
  status=$(curl -s -o "$body_file" -w '%{http_code}' \
    --max-time "$TIMEOUT" \
    "${headers[@]}" \
    -X POST -d "$body" \
    "$BASE_URL$path")
  end_ms=$(now_ms)
  latency_ms=$((end_ms - start_ms))

  local notes result
  if [[ "$status" == "200" ]]; then
    notes=$(extract_note "$body_file" "$expected_field")
    [[ -z "$notes" ]] && notes="ok"
    result="PASS"; PASS=$((PASS + 1))
  else
    notes=$(error_excerpt "$body_file")
    result="FAIL"; FAIL=$((FAIL + 1))
  fi
  print_row "$route" "$status" "$latency_ms" "$notes" "$result"
  rm -f "$body_file"
}

# ── Run ─────────────────────────────────────────────────────────────────────
print_header

# 1-3. Public liveness routes — no auth, no signing.
probe_get "GET /healthz"                "/healthz"                "status"
probe_get "GET /readyz"                 "/readyz"                 "status"
probe_get "GET /.well-known/agent.json" "/.well-known/agent.json" "name"

# Token + signing key are needed for every POST below.
acquire_id_token || true

# 4. instant-answer/answer
probe_post "POST /v1/instant-answer/answer" "/v1/instant-answer/answer" \
  '{"question":"What is photosynthesis?","language":"English","gradeLevel":"Class 5","userId":"smoke-user"}' \
  "answer"

# 5. lesson-plan/generate
probe_post "POST /v1/lesson-plan/generate" "/v1/lesson-plan/generate" \
  '{"topic":"Photosynthesis","language":"en","gradeLevels":["Class 5"],"subject":"Science","userId":"smoke-user"}' \
  "title"

# 6. parent-call/reply — minimal valid payload (matches post-deploy-smoke).
probe_post "POST /v1/parent-call/reply" "/v1/parent-call/reply" \
  '{"callSid":"smoke-test","turnNumber":1,"studentName":"Aarav","className":"Class 5","subject":"Math","reason":"smoke","teacherMessage":"smoke","parentLanguage":"en","parentSpeech":"smoke test"}' \
  "reply"

# 7. parent-call/summary
probe_post "POST /v1/parent-call/summary" "/v1/parent-call/summary" \
  '{"callSid":"smoke-test","studentName":"Aarav","className":"Class 5","subject":"Math","parentLanguage":"en","transcript":[{"role":"agent","text":"hello"},{"role":"parent","text":"hello"}]}' \
  "summary"

# 8. vidya/orchestrate
probe_post "POST /v1/vidya/orchestrate" "/v1/vidya/orchestrate" \
  '{"prompt":"Make a quiz on photosynthesis","language":"English","userId":"smoke-user"}' \
  "action"

# ── Summary ─────────────────────────────────────────────────────────────────
TOTAL_END=$(date +%s)
TOTAL_S=$((TOTAL_END - TOTAL_START))
TOTAL=$((PASS + FAIL + SKIP))

printf '\n'
printf 'Summary: %d/%d PASS, %d FAIL, %d SKIP\n' "$PASS" "$TOTAL" "$FAIL" "$SKIP"
printf 'Total time: %ds\n' "$TOTAL_S"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
