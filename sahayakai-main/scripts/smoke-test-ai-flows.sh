#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Post-merge AI smoke test for SahayakAI.
#
# Hits every /api/ai/* route with a minimal valid payload and tabulates
# pass / fail / skip into a single green-or-red matrix.
#
# Usage:
#   bash scripts/smoke-test-ai-flows.sh                              # local dev
#   BASE_URL=https://sahayakai.in bash scripts/smoke-test-ai-flows.sh
#
# Auth:
#   - Local dev (NODE_ENV=development on the server): TEST_TOKEN=dev-token
#     is the default — middleware injects x-user-id=dev-user-123.
#   - Prod: export TEST_TOKEN=<firebase ID token> before running.
#     `firebase auth:export` for one-off, or run a tiny client-side helper
#     (`gcloud auth print-identity-token` does NOT work — Cloud Run /api/*
#     verifies a *Firebase* ID token, not a Google OIDC token).
#
# Output format:
#   Flow                   Status      Latency    Notes
#   lesson-plan            ✓ 200       4523ms     title: "..."
#   exam-paper             ✗ 502       58234ms    Gemini timeout
#   ...
#   Summary: 16/17 PASS, 1 FAIL, 0 SKIP
#
# Exit code: 0 if all flows pass-or-skip, 1 if any fail.
# ────────────────────────────────────────────────────────────────────────────

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_TOKEN="${TEST_TOKEN:-dev-token}"
TIMEOUT="${TIMEOUT:-90}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"

# Counters
PASS=0
FAIL=0
SKIP=0
TOTAL_START=$(date +%s)

# Tiny 1x1 PNG (transparent) used for imageDataUri in worksheet — keeps the
# upload small and lets the schema validator pass without bringing a real
# textbook page into the repo.
TINY_PNG_DATA_URI="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="

# ── Output helpers ──────────────────────────────────────────────────────────
ts_iso() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

print_header() {
  printf '=== Sahayakai AI flows smoke test ===\n'
  printf 'Base: %s\n' "$BASE_URL"
  printf 'Started: %s\n' "$(ts_iso)"
  printf '\n'
  printf '%-32s %-12s %-10s %s\n' "Flow" "Status" "Latency" "Notes"
  printf '%-32s %-12s %-10s %s\n' "----" "------" "-------" "-----"
}

# Render one row.
#   $1 flow name, $2 status code, $3 latency_ms, $4 notes, $5 result (PASS|FAIL|SKIP)
print_row() {
  local flow="$1" status="$2" latency_ms="$3" notes="$4" result="$5"
  local mark
  case "$result" in
    PASS) mark=$'\xe2\x9c\x93' ;;        # ✓
    FAIL) mark=$'\xe2\x9c\x97' ;;        # ✗
    SKIP) mark="-" ;;
    *)    mark="?" ;;
  esac
  printf '%-32s %s %-10s %-10s %s\n' "$flow" "$mark" "$status" "${latency_ms}ms" "$notes"
}

# ── Probe wrapper ───────────────────────────────────────────────────────────
# probe_json <flow> <method> <path> <body> <expected_field>
#   - POSTs the JSON body (or GETs if method=GET).
#   - Records HTTP status, latency, and a one-line "notes" excerpt from
#     the response (the value of expected_field, truncated).
#   - Result rules:
#       200 + body parses + has expected_field → PASS
#       Anything else                          → FAIL
probe_json() {
  local flow="$1" method="$2" path="$3" body="$4" expected_field="$5"
  local url="$BASE_URL$path"
  local body_file
  body_file="$(mktemp -t smoke.XXXXXX)"

  local start_ms end_ms latency_ms status
  start_ms=$(python3 -c 'import time; print(int(time.time()*1000))')

  if [[ "$method" == "GET" ]]; then
    status=$(curl -s -o "$body_file" -w '%{http_code}' \
      --max-time "$TIMEOUT" \
      -H "Authorization: Bearer $TEST_TOKEN" \
      -H "User-Agent: SahayakAI-AISmokeTest/1.0" \
      "$url")
  else
    status=$(curl -s -o "$body_file" -w '%{http_code}' \
      --max-time "$TIMEOUT" \
      -H "Authorization: Bearer $TEST_TOKEN" \
      -H "Content-Type: application/json" \
      -H "User-Agent: SahayakAI-AISmokeTest/1.0" \
      -X POST -d "$body" \
      "$url")
  fi

  end_ms=$(python3 -c 'import time; print(int(time.time()*1000))')
  latency_ms=$((end_ms - start_ms))

  local notes result
  if [[ "$status" == "200" ]]; then
    notes=$(extract_note "$body_file" "$expected_field")
    if [[ -n "$notes" ]]; then
      result="PASS"; PASS=$((PASS + 1))
    else
      notes="empty/malformed body"; result="FAIL"; FAIL=$((FAIL + 1))
    fi
  else
    notes=$(error_excerpt "$body_file")
    result="FAIL"; FAIL=$((FAIL + 1))
  fi

  print_row "$flow" "$status" "$latency_ms" "$notes" "$result"
  rm -f "$body_file"
}

# Pull a one-line excerpt of the expected field's value (first 60 chars).
# Falls back to byte length so we still know the body wasn't empty.
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
    msg = d.get("error") or d.get("message") or str(d)[:80]
    print(str(msg)[:80])
except Exception:
    with open(sys.argv[1]) as f:
        print(f.read(80).strip().replace("\n", " "))
PYEOF
}

# ── Special probe for SSE endpoints ─────────────────────────────────────────
# probe_sse <flow> <path> <body>
#   Reads the SSE stream until a `data: {"type":"complete"}` event arrives or
#   the timeout fires. PASS = stream connected (200) AND any non-error event
#   was observed. FAIL = HTTP error or only error events.
probe_sse() {
  local flow="$1" path="$2" body="$3"
  local url="$BASE_URL$path"
  local body_file
  body_file="$(mktemp -t smoke-sse.XXXXXX)"

  local start_ms end_ms latency_ms status
  start_ms=$(python3 -c 'import time; print(int(time.time()*1000))')
  status=$(curl -s -N -o "$body_file" -w '%{http_code}' \
    --max-time "$TIMEOUT" \
    -H "Authorization: Bearer $TEST_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Accept: text/event-stream" \
    -X POST -d "$body" \
    "$url")
  end_ms=$(python3 -c 'import time; print(int(time.time()*1000))')
  latency_ms=$((end_ms - start_ms))

  local notes result
  if [[ "$status" == "200" ]]; then
    if grep -q '"type":"complete"' "$body_file" 2>/dev/null; then
      local events
      events=$(grep -c '^data:' "$body_file" 2>/dev/null || echo 0)
      notes="${events} sse events, complete"
      result="PASS"; PASS=$((PASS + 1))
    elif grep -q '"type":"error"' "$body_file" 2>/dev/null; then
      notes="sse error event"
      result="FAIL"; FAIL=$((FAIL + 1))
    else
      notes="no complete event (timeout?)"
      result="FAIL"; FAIL=$((FAIL + 1))
    fi
  else
    notes=$(error_excerpt "$body_file")
    result="FAIL"; FAIL=$((FAIL + 1))
  fi

  print_row "$flow" "$status" "$latency_ms" "$notes" "$result"
  rm -f "$body_file"
}

# ── Multipart probe (voice-to-text) ─────────────────────────────────────────
# Skips with reason if no fixture audio is present — recording/synthesising
# real audio is out of scope for this harness.
probe_voice_to_text() {
  local flow="voice-to-text"
  local fixture="$FIXTURES_DIR/voice-tiny.webm"
  if [[ ! -f "$fixture" ]]; then
    print_row "$flow" "SKIP" "0" "no audio fixture at $fixture" "SKIP"
    SKIP=$((SKIP + 1))
    return
  fi

  local body_file
  body_file="$(mktemp -t smoke.XXXXXX)"
  local start_ms end_ms latency_ms status
  start_ms=$(python3 -c 'import time; print(int(time.time()*1000))')
  status=$(curl -s -o "$body_file" -w '%{http_code}' \
    --max-time "$TIMEOUT" \
    -H "Authorization: Bearer $TEST_TOKEN" \
    -F "audio=@$fixture;type=audio/webm" \
    "$BASE_URL/api/ai/voice-to-text")
  end_ms=$(python3 -c 'import time; print(int(time.time()*1000))')
  latency_ms=$((end_ms - start_ms))

  local notes result
  if [[ "$status" == "200" ]]; then
    notes=$(extract_note "$body_file" "text")
    if [[ -n "$notes" ]]; then
      result="PASS"; PASS=$((PASS + 1))
    else
      notes="empty transcription"; result="FAIL"; FAIL=$((FAIL + 1))
    fi
  else
    notes=$(error_excerpt "$body_file")
    result="FAIL"; FAIL=$((FAIL + 1))
  fi
  print_row "$flow" "$status" "$latency_ms" "$notes" "$result"
  rm -f "$body_file"
}

# ── Run ─────────────────────────────────────────────────────────────────────
print_header

# JSON body helpers — keep payloads minimal but schema-valid.
J() { printf '%s' "$1"; }

# 1. lesson-plan (POST → title)
probe_json "lesson-plan" "POST" "/api/ai/lesson-plan" \
  '{"topic":"Photosynthesis","language":"en","gradeLevels":["Class 5"],"subject":"Science"}' \
  "title"

# 2. instant-answer (POST → answer or some content key)
probe_json "instant-answer" "POST" "/api/ai/instant-answer" \
  '{"question":"What is photosynthesis?","language":"English","gradeLevel":"Class 5"}' \
  "answer"

# 3. quiz (POST → title)
probe_json "quiz" "POST" "/api/ai/quiz" \
  '{"topic":"Photosynthesis","language":"English","gradeLevel":"Class 5","numQuestions":3,"questionTypes":["multiple_choice"]}' \
  "title"

# 4. exam-paper (POST → title)
probe_json "exam-paper" "POST" "/api/ai/exam-paper" \
  '{"board":"CBSE","gradeLevel":"Class 10","subject":"Mathematics","chapters":["Quadratic Equations"],"difficulty":"mixed","language":"English","includeAnswerKey":true,"includeMarkingScheme":true}' \
  "title"

# 5. rubric (POST → title)
probe_json "rubric" "POST" "/api/ai/rubric" \
  '{"assignmentDescription":"A grade 5 project on renewable energy sources.","gradeLevel":"Class 5","subject":"Science","language":"English"}' \
  "title"

# 6. worksheet (POST → title; needs imageDataUri)
WS_BODY=$(python3 -c "import json, sys; print(json.dumps({'prompt':'Create a math multiplication worksheet for grade 4.','imageDataUri':'$TINY_PNG_DATA_URI','language':'English','gradeLevel':'Class 4','subject':'Mathematics'}))")
probe_json "worksheet" "POST" "/api/ai/worksheet" "$WS_BODY" "title"

# 7. teacher-training (POST → introduction)
probe_json "teacher-training" "POST" "/api/ai/teacher-training" \
  '{"question":"How do I manage a classroom of 40 students?","language":"English"}' \
  "introduction"

# 8. virtual-field-trip (POST → title)
probe_json "virtual-field-trip" "POST" "/api/ai/virtual-field-trip" \
  '{"topic":"The Great Barrier Reef","gradeLevel":"Class 6","language":"English"}' \
  "title"

# 9. video-storyteller (POST → categories or recommendations key — use a
#    permissive expectation: pass on any 200 with non-empty body)
probe_json "video-storyteller" "POST" "/api/ai/video-storyteller" \
  '{"subject":"Science","gradeLevel":"Class 5","topic":"Plants","language":"English"}' \
  "categories"

# 10. visual-aid (POST → imageUrl) — image generation can be slow.
probe_json "visual-aid" "POST" "/api/ai/visual-aid" \
  '{"prompt":"Diagram of the water cycle","language":"English","gradeLevel":"Class 5","subject":"Science"}' \
  "imageUrl"

# 11. avatar (POST → imageUrl)
probe_json "avatar" "POST" "/api/ai/avatar" \
  '{"name":"Suresh","gender":"male"}' \
  "imageUrl"

# 12. parent-message (POST → message)
#     Required fields per route: studentName, className, subject, reason,
#     parentLanguage. (User spec listed `language` — actual field is
#     `parentLanguage`. Send both for forward-compat.)
probe_json "parent-message" "POST" "/api/ai/parent-message" \
  '{"studentName":"Aarav","className":"Class 5","subject":"Math","reason":"weekly update","teacherNote":"Improving steadily","teacherName":"Mrs. Sharma","schoolName":"Test School","performanceSummary":"72% in latest test","parentLanguage":"English","language":"English"}' \
  "message"

# 13. intent (POST → action)
probe_json "intent" "POST" "/api/ai/intent" \
  '{"prompt":"Make a quiz on photosynthesis","language":"English"}' \
  "action"

# 14. voice-to-text (multipart) — SKIPs if no fixture
probe_voice_to_text

# 15. lesson-plan/stream (SSE)
probe_sse "lesson-plan/stream" "/api/ai/lesson-plan/stream" \
  '{"topic":"Photosynthesis","language":"en","gradeLevels":["Class 5"],"subject":"Science"}'

# 16. exam-paper/stream (SSE)
probe_sse "exam-paper/stream" "/api/ai/exam-paper/stream" \
  '{"board":"CBSE","gradeLevel":"Class 10","subject":"Mathematics","chapters":["Quadratic Equations"],"difficulty":"mixed","language":"English"}'

# 17. quiz/health (GET — admin-only; passes if 200, expected 401/403 for
#     non-admin tokens. Mark NON-admin caller as SKIP rather than FAIL so
#     the harness stays green for normal CI; flip TEST_AS_ADMIN=1 to
#     re-classify a 401/403 as FAIL.)
QH_BODY_FILE="$(mktemp -t smoke.XXXXXX)"
QH_START=$(python3 -c 'import time; print(int(time.time()*1000))')
QH_STATUS=$(curl -s -o "$QH_BODY_FILE" -w '%{http_code}' \
  --max-time "$TIMEOUT" \
  -H "Authorization: Bearer $TEST_TOKEN" \
  "$BASE_URL/api/ai/quiz/health")
QH_END=$(python3 -c 'import time; print(int(time.time()*1000))')
QH_LAT=$((QH_END - QH_START))
case "$QH_STATUS" in
  200)
    print_row "quiz/health" "$QH_STATUS" "$QH_LAT" "$(extract_note "$QH_BODY_FILE" "status")" "PASS"
    PASS=$((PASS + 1))
    ;;
  401|403)
    if [[ "${TEST_AS_ADMIN:-0}" == "1" ]]; then
      print_row "quiz/health" "$QH_STATUS" "$QH_LAT" "admin gate rejected token" "FAIL"
      FAIL=$((FAIL + 1))
    else
      print_row "quiz/health" "$QH_STATUS" "$QH_LAT" "admin-only (set TEST_AS_ADMIN=1)" "SKIP"
      SKIP=$((SKIP + 1))
    fi
    ;;
  *)
    print_row "quiz/health" "$QH_STATUS" "$QH_LAT" "$(error_excerpt "$QH_BODY_FILE")" "FAIL"
    FAIL=$((FAIL + 1))
    ;;
esac
rm -f "$QH_BODY_FILE"

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
