# Smoke-test fixtures

Tiny binary inputs needed by `scripts/smoke-test-ai-flows.sh`.

## Files

| File             | Used by               | How to regenerate |
| ---------------- | --------------------- | ----------------- |
| `voice-tiny.webm`| `voice-to-text` probe | See below.        |

The PNG used by `worksheet` is inlined as a base64 data-URI in the script itself
(1x1 transparent), so no fixture file is needed for it.

## Why these aren't checked in by default

Audio files are real binaries; they bloat the repo and don't help PR review.
The script gracefully **SKIPs** the voice probe when the fixture is absent.

## Generating `voice-tiny.webm` locally

If you want voice-to-text covered in your local run, drop a ~2-second
`audio/webm;codecs=opus` clip here, e.g. via ffmpeg:

```bash
ffmpeg -f lavfi -i "sine=frequency=440:duration=2" \
  -c:a libopus -b:a 32k voice-tiny.webm
```

Anything under 1 MB works. Sarvam STT will return empty/garbage for a sine
wave — which is fine for a wiring test; the harness checks for HTTP 200 +
non-empty `text` field, not transcription quality.
