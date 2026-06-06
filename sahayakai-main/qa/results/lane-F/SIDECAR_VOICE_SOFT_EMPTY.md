# Sidecar Voice-to-Text Soft-Empty Parity

**Date:** 2026-06-06
**Branch:** `fix/sidecar-voice-soft-empty` → merged into `develop` (commit `29e38b943`)
**Mirrors:** TS commit `727522140` — `src/ai/flows/voice-to-text.ts:262, 298`

## Problem

Sidecar Python voice-to-text raised `AgentError(INTERNAL, http_status=502)` when Gemini returned an empty transcript on short / silent / sub-threshold audio. The UI surfaced this as an HTTP 500 toast, and the client's retry loop burned 3× cost re-submitting guaranteed-empty audio.

The TS flow had this exact bug and shipped a fix in commit `727522140`:

```ts
if (!transcription?.text) {
  // Soft-empty
  console.warn('[voiceToText] empty transcription — returning soft-empty');
  return { text: '', language: normalizeIsoLang(input.expectedLanguage) };
}
```

## Fix

`/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-agents/src/sahayakai_agents/agents/voice_to_text/router.py`

- Replaced the `raise AgentError("Voice-to-text returned empty response")` branch in `_run_pipeline_via_runner` with a soft-empty return.
- Added `_normalize_expected_language(...)` helper — mirrors TS `normalizeIsoLang`. Accepts only ISO codes in `ALLOWED_LANGUAGE_ISO_CODES`; otherwise returns `None` (the behavioural guard's `assert_language_iso_allowed` accepts `None` but rejects unknown codes — so we cannot guess).
- Threaded `expected_language` through `_run_pipeline_via_runner(..., expected_language=...)` and the inner `_do(...)` closure inside `_run_transcriber`.
- `log.warning("voice_to_text.transcriber.soft_empty", expected_language=...)` so the soft-empty rate is monitorable in Cloud Logging.

After the fix:

```python
if not final_text.strip():
    log.warning(
        "voice_to_text.transcriber.soft_empty",
        expected_language=expected_language,
    )
    return VoiceToTextCore(
        text="",
        language=_normalize_expected_language(expected_language),
    )
```

Response goes back as HTTP 200 with `{ text: "", language: "<hint>" | null, sidecarVersion, latencyMs, modelUsed }`.

## Tests

### Unit — `tests/unit/test_voice_to_text_adk.py`

New `TestSoftEmptyTranscription` class:

1. `test_normalize_expected_language_passes_known_iso` — `"hi"`, `"HI"`, `"  bn  "` → normalised correctly.
2. `test_normalize_expected_language_rejects_unknown` — `"fr"`, `"es"`, `""`, `None`, `"hi-IN"` → `None`.
3. `test_run_pipeline_soft_empty_returns_empty_core` — patches `InMemoryRunner` to yield zero events; asserts `_run_pipeline_via_runner(expected_language="hi")` returns `VoiceToTextCore(text="", language="hi")` instead of raising.
4. `test_run_pipeline_soft_empty_unknown_hint_returns_null_language` — same flow with `None`, `""`, `"fr"` hints → `language=None`.

### Integration — `tests/integration/test_voice_to_text_router.py`

5. `test_soft_empty_returns_200_with_empty_text` — POST with `expectedLanguage="hi"` and a queued `{"text": "", "language": "hi"}` response → HTTP 200, `text: ""`, `language: "hi"`.
6. `test_soft_empty_without_language_hint_returns_null_language` — same without language hint → HTTP 200, `text: ""`, `language: null`.

Also updated the integration `_fake_run_pipeline_via_runner` signature to accept the new `expected_language` keyword.

### Results

```
tests/unit/test_voice_to_text_adk.py:   10 passed
tests/integration/test_voice_to_text_router.py: 10 passed
ruff: All checks passed
```

## Deploy

- Cloud Build: `17824585-dc04-46e9-80f9-394abf8bdee5` — **SUCCESS** (8m31s)
- Image: `asia-southeast1-docker.pkg.dev/sahayakai-b4248/sahayakai/sahayakai-agents:29e38b943`
- Service: `sahayakai-agents` (staging tag from cloudbuild substitutions); `gcloud run services replace` against the rendered `service.yaml` (no raw `gcloud run deploy`).

## Files Changed

- `sahayakai-agents/src/sahayakai_agents/agents/voice_to_text/router.py` — +35 / −3
- `sahayakai-agents/tests/integration/test_voice_to_text_router.py` — +40 / −2 (fake signature + 2 new tests)
- `sahayakai-agents/tests/unit/test_voice_to_text_adk.py` — +148 (new `TestSoftEmptyTranscription` class)

## Git

- Worktree: `.claude/worktrees/sidecar-voice-soft-empty/`
- Feature branch: `fix/sidecar-voice-soft-empty` (commit `45c88ece6`)
- Merged `--no-ff` into `develop` as commit `29e38b943`
- Pushed both branches to `origin`
- **`main` untouched** — per repo rules.
