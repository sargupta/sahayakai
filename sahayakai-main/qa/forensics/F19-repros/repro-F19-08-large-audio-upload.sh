#!/usr/bin/env bash
# F19-08 repro: 100 MB audio upload fully buffered before 413 (P2)
#
# Demonstrates that /api/ai/voice-to-text accepts the full body into memory
# before applying the 10 MB cap.
set -euo pipefail

HOST="${HOST:?set HOST}"
ID_TOKEN="${ID_TOKEN:?set ID_TOKEN}"
PARALLEL="${PARALLEL:-1}"

dd if=/dev/urandom of=/tmp/big.webm bs=1M count=100 status=none

for i in $(seq 1 "$PARALLEL"); do
  ( time curl -sS -X POST "$HOST/api/ai/voice-to-text" \
        -H "Authorization: Bearer $ID_TOKEN" \
        -F "audio=@/tmp/big.webm;type=audio/webm" \
        -o /tmp/voice-out-$i.json ; echo "[$i] done" ) &
done

wait
echo "---"
echo "Expected: HTTP 413 in body. Verify Cloud Run memory spike via:"
echo "  gcloud monitoring time-series list \\"
echo "    --filter='metric.type=\"run.googleapis.com/container/memory/utilizations\" AND resource.labels.service_name=\"sahayakai-hotfix-resilience\"'"
