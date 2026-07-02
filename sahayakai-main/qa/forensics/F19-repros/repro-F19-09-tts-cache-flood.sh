#!/usr/bin/env bash
# F19-09 repro: flood TTS_CACHE with 500 large-buffer entries (P2)
#
# Each call uses a unique text → unique cache key. Each entry holds a base64
# MP3 string. With per-entry size uncapped, 500 entries of 2500-char inputs
# can pin ~150-300 MB resident on the dispatcher.
set -euo pipefail

HOST="${HOST:?set HOST}"
ID_TOKEN="${ID_TOKEN:?set ID_TOKEN}"

for i in $(seq 1 500); do
  TEXT=$(python3 -c "print(f'unique payload $i ' + 'का पाठ ' * 400)")
  payload=$(python3 -c "import json,sys; print(json.dumps({'text': sys.argv[1], 'targetLang': 'hi-IN'}))" "$TEXT")
  curl -sS -X POST "$HOST/api/tts" \
       -H "Authorization: Bearer $ID_TOKEN" \
       -H "Content-Type: application/json" \
       -d "$payload" -o /dev/null
  if (( i % 50 == 0 )); then echo "$i / 500"; fi
done

echo "---"
echo "Cache should now hold 500 entries. Watch memory:"
echo "  gcloud monitoring time-series list \\"
echo "    --filter='metric.type=\"run.googleapis.com/container/memory/utilizations\" AND resource.labels.service_name=\"sahayakai-hotfix-resilience\"'"
