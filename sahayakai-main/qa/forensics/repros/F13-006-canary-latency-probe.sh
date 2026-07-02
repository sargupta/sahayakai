#!/usr/bin/env bash
# Repro / probe script for F13-006: 50 RPS × 60s per canary agent.
# Requires: `hey` (brew install hey) and a valid bearer + App Check token.
set -euo pipefail

BASE="${CANARY_BASE:?e.g. https://sahayakai-hotfix-resilience-xxx.run.app}"
TOKEN="${ID_TOKEN:?Firebase ID token}"
APPCHECK="${APP_CHECK_TOKEN:?App Check token}"

agents=(
  lesson-plan quiz exam-paper instant-answer worksheet rubric
  visual-aid avatar virtual-field-trip teacher-training
  parent-message video-storyteller assessment-scanner voice-to-text
)

mkdir -p qa/forensics/repros/out
for a in "${agents[@]}"; do
  echo "=== ${a} ==="
  hey -z 60s -c 50 -m POST \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "X-Firebase-AppCheck: ${APPCHECK}" \
      -H "Content-Type: application/json" \
      -D "qa/forensics/repros/payloads/${a}.json" \
      "${BASE}/api/ai/${a}" \
      | tee "qa/forensics/repros/out/${a}.txt"
done

echo "Aggregate p50/p95/p99 per agent in qa/forensics/repros/out/. Compare against Genkit baseline."
