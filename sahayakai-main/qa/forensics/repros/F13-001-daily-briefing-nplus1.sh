#!/usr/bin/env bash
# Repro for F13-001: N+1 stateGroupRef.get() in daily-briefing cron.
# Run locally with emulator or against canary.
set -euo pipefail

URL="${1:-http://localhost:3000/api/jobs/daily-briefing}"
TOKEN="${CRON_SECRET:?set CRON_SECRET}"

echo "Triggering daily-briefing — watch logs for sequential 'stateGroupRef.get' calls."
start=$(date +%s%N)
curl -sS -X POST -H "Authorization: Bearer ${TOKEN}" "${URL}" -o /tmp/db-resp.json -w "HTTP %{http_code} in %{time_total}s\n"
end=$(date +%s%N)
echo "Wall: $(( (end - start) / 1000000 )) ms"
echo "Expect: linear scaling with number of states having curated news (28 states max)."
