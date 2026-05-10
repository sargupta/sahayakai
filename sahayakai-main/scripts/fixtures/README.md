# Smoke-test fixtures

Tiny binary inputs needed by `scripts/smoke-test-ai-flows.sh`.

## Files

| File             | Used by               | How to regenerate |
| ---------------- | --------------------- | ----------------- |
| `voice-tiny.webm`| `voice-to-text` probe | See below.        |

The PNG used by `worksheet` is inlined as a base64 data-URI in the script itself
(1x1 transparent), so no fixture file is needed for it.

## What's checked in

`voice-tiny.webm` is a synthetic 2-second 440 Hz sine wave (~11 KB,
opus-in-webm) generated via ffmpeg. Small enough to ship in-tree, large
enough to exercise the full upload + multipart parse path. Sarvam STT
returns garbage transcription on a sine wave — that's fine, the harness
asserts on HTTP 200 + non-empty `text` field, not transcription quality.

The script no longer SKIPs the voice probe in CI; if `voice-tiny.webm`
is ever deleted, the probe will SKIP gracefully and the harness keeps
running.

## Regenerating `voice-tiny.webm` from scratch

```bash
ffmpeg -f lavfi -i "sine=frequency=440:duration=2" \
  -c:a libopus -b:a 32k -y scripts/fixtures/voice-tiny.webm
```

Keep the file under 100 KB so the smoke harness round-trip stays fast.
