#!/usr/bin/env bash
# F19-07 repro: long-text TTS fan-out (P1)
#
# Sends a 50,000-char Devanagari payload to /api/tts. Expected behaviour today:
#   - server splits into ~100 chunks of 500 chars
#   - fires Promise.all over 100 concurrent fetches to texttospeech.googleapis.com
#   - holds ~5–50 MB transient buffer of base64 MP3 strings until concat
#
# Run with `PARALLEL=10` to amplify the dispatcher impact.
set -euo pipefail

HOST="${HOST:?set HOST, e.g. https://sahayakai-hotfix-resilience-...run.app}"
ID_TOKEN="${ID_TOKEN:?set ID_TOKEN from Firebase auth}"
PARALLEL="${PARALLEL:-1}"

TEXT=$(python3 -c "print('हे शिक्षक. ' * 5000)") # ~55,000 chars

payload=$(python3 -c "import json,sys; print(json.dumps({'text': sys.argv[1], 'targetLang': 'hi-IN'}))" "$TEXT")

for i in $(seq 1 "$PARALLEL"); do
  ( time curl -sS -X POST "$HOST/api/tts" \
        -H "Authorization: Bearer $ID_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        -o /tmp/tts-out-$i.json ; echo "[$i] done" ) &
done

wait
echo "---"
echo "watch:"
echo "  gcloud monitoring time-series list \\"
echo "    --filter='metric.type=\"run.googleapis.com/container/memory/utilizations\" AND resource.labels.service_name=\"sahayakai-hotfix-resilience\"'"
