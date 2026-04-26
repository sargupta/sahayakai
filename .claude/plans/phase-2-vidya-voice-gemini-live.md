# Phase 2 — VIDYA Voice via Gemini Live

## Headline

Move parent-call replies from **batch text** (Phase 1: Twilio `<Gather><Say>` → text Gemini) to **streaming bidirectional voice** (Phase 2: Twilio Media Streams → Gemini Live → Twilio Media Streams). Same behavioural guarantees; sub-second first-byte; single WebSocket session per call.

## Why

Phase 1 ships parity scaffolding for the existing batch flow. The Phase 1 sidecar still inherits Twilio's `<Gather>` STT + `<Say>` TTS roundtrip, which costs ~3-4 seconds per turn (1s STT + 1.5s LLM + 1s TTS speak) and is the dominant source of awkward conversational gaps. Gemini Live collapses STT + LLM + TTS into one streaming connection; first-byte latency drops to ~500ms and the conversation feels like a real phone call.

This is a strict superset of Phase 1 — the batch path stays as the fallback when Gemini Live degrades.

## Scope

### In

- Twilio `<Connect><Stream>` → sidecar WebSocket endpoint
- Sidecar voice sub-router that brokers Twilio audio frames to Gemini Live
- μ-law 8kHz ↔ PCM 16-bit 16kHz audio format conversion
- Real-time behavioural guard (sliding-window check on partial outputs, not just final)
- Session-resume on disconnect (Gemini Live session ID persisted in Firestore)
- Voice fixture recorder (real audio, not just text)
- Voice parity comparator (audio embedding cosine + transcript cosine)
- Cloud Run WS support (sidecar `--allow-ws` revision)
- Feature-flag mode `streaming` extending `parentCallSidecarMode`

### Out (Phase 3+)

- Multi-modal (image+voice) support
- Speaker diarisation (multiple parents on one line)
- Voice cloning / custom Indic accents (Gemini Live's default Indic voices are sufficient for v1)
- Streaming via Pipecat (already exists in route.ts; not wiring it up here)

## Architecture

```
Parent phone     ───── PSTN ─────► Twilio
                                      │
                                      │ <Connect><Stream> over WSS
                                      ▼
                        sahayakai-agents:/v2/parent-call/voice-stream
                                      │
                                      │ open Gemini Live session
                                      ▼
                              google.genai.live.connect(model="gemini-2.5-live-preview")
                                      │
                                      │ bidirectional audio
                                      ▼
                              Gemini Live (Google managed)

  Behavioural guard runs on the audio's partial transcript stream as
  it arrives. If a forbidden phrase is detected mid-utterance, the
  sidecar:
    1. Cuts the Gemini Live session.
    2. Sends Twilio a canned safe-wrap-up audio frame.
    3. Hangs up.

  All session metadata (call_sid, start/end timestamps, partial
  transcript, final transcript, audio durations, behavioural-guard
  events) lands in Firestore at `agent_voice_sessions/{call_sid}`.
```

## Sub-phases

### 2.0 Design + Spike (1 week)

**Deliverables:**
- This document
- Spike scaffolding under `sahayakai-agents/spikes/gemini_live/`:
  - `audio.py` — μ-law ↔ PCM 16-bit + 8 kHz ↔ 16 kHz resample helpers
  - `test_audio.py` — 13 unit tests pinning conversion math
  - `latency_benchmark.py` — three-mode benchmark: audio-only,
    end-to-end (stub until Gemini Live integration), with-guard (stub)
  - `README.md` — operator workflow + decision gates
- Cost benchmark: per-minute Gemini Live spend at expected concurrency.

**Gates and current results:**

| Gate | Target | Spike status | Result |
|---|---|---|---|
| Audio decode + resample p95 | < 5 ms | ✅ measured | **0.003 ms p95** (1000 iterations local; on Cloud Run gen2 will be ~10-50× higher but well under target) |
| Gemini Live first-byte p95 | < 1500 ms (honest) | ⏳ blocked on regional GA + DPDP region migration | TBD |
| Cost within 2× Phase 1 | per-call comparable | ⏳ blocked on Live pricing GA | TBD |
| Partial-guard cut p95 | < 250 ms | ⏳ depends on Live SDK partial transcript cadence | TBD |

### 2.1 Voice sub-router (3-5 days)

**Files:**
- `sahayakai-agents/src/sahayakai_agents/agents/parent_call/voice_router.py` — FastAPI WebSocket endpoint at `/v2/parent-call/voice-stream`. Accepts the Twilio Media Streams envelope; dispatches each frame to a `VoiceSession` instance.
- `sahayakai-agents/src/sahayakai_agents/agents/parent_call/voice_session.py` — per-call state machine. Holds the Gemini Live connection, the partial-transcript buffer, the behavioural-guard checker, and the outbound audio queue.
- `sahayakai-agents/src/sahayakai_agents/agents/parent_call/audio.py` — μ-law ↔ PCM 16kHz conversion, framing, silence detection.

**Behavioural guard surface:**
- Reuse `_behavioural.assert_all_rules` but call it on the **rolling partial transcript** every ~500ms while audio streams. Forbidden phrases detected mid-utterance trigger an immediate cut.
- New `assert_partial_safe(transcript)` helper: only the forbidden-phrase check runs on partials; sentence-count and script-match are deferred to the final.

**Session model:**
- `VoiceSessionRecord` with `call_sid`, `gemini_live_session_id`, `started_at`, `ended_at`, `final_transcript`, `behavioural_events`, `audio_duration_ms`. Persisted in `agent_voice_sessions/{call_sid}`.
- TTL via `expireAt = ended_at + 24h` — same policy as the Phase 1 batch sessions.

**Gate (unit):**
- 50 + tests covering frame parsing, format conversion (μ-law sample → PCM sample → μ-law sample round-trip with <0.1 dB loss), partial-transcript guard fires on forbidden phrases within 500ms of the offending frame.

### 2.2 Gemini Live broker (3 days)

**Files:**
- `sahayakai-agents/src/sahayakai_agents/agents/parent_call/live_client.py` — async wrapper around `google.genai.live.connect`. Owns the Gemini Live session lifecycle: open, send audio frame, receive audio frame, close.
- `sahayakai-agents/src/sahayakai_agents/agents/parent_call/live_prompts.py` — system instruction + tool config for the Live session. Same Handlebars-rendered context as the batch prompt; the only delta is voice-specific framing ("you are speaking on a phone call, keep utterances < 5 seconds, do not generate long monologues").

**Resilience:**
- `run_resiliently` extended with a `LiveSessionError` class that catches Gemini Live's WS-level disconnects. Retry policy: at most one reconnect per call; if the second connection drops we fall back to canned safe wrap-up.
- Multi-key rotation: same key pool as batch (`settings.genai_keys`); Live sessions key-rotate per session, not per request.

**Gate (integration):**
- A FastAPI WebSocket test client streams a recorded μ-law file through `/v2/parent-call/voice-stream`, asserts a Gemini-Live response audio file is returned, transcribes both with Whisper, asserts the transcript pair scores LaBSE >= 0.85.

### 2.3 Disconnect & resume (2 days)

**Why:** Twilio Media Streams disconnect when the parent's mobile network blips. Without resume, every blip kills the call. Gemini Live sessions can be resumed within a 5-minute window via the session ID.

**Files:**
- `voice_session.py` extended with `resume(session_id)`: re-opens a Gemini Live session pointing at the same session_id, replays the buffered partial transcript so the model has context, resumes streaming.
- `agent_voice_sessions/{call_sid}` Firestore doc gains a `gemini_live_session_id` field updated on every partial.

**Gate (chaos):**
- A test harness drops the WS mid-call and reconnects within 60s; assert the conversation continues coherently with the same Gemini Live session id; assert the first-byte after reconnect < 1500ms.

### 2.4 Real-time behavioural guard (2 days)

**Why:** The Phase 1 guard runs post-response. With streaming voice, half the reply has already played to the parent before the guard finishes its checks. We need guards that fire on partials.

**Files:**
- `_behavioural.py` extended with `assert_partial_safe(transcript_so_far)`. Runs only the forbidden-phrase check (cheapest, deterministic). Sentence-count and script-match still run on final.
- `voice_session.py` calls `assert_partial_safe` on every partial transcript token from Gemini Live.

**Cut behaviour:**
- On guard trip:
  1. Send an audio frame containing the canned safe wrap-up to Twilio.
  2. Close the Gemini Live session.
  3. Mark the Firestore session with `behavioural_events: ["partial_guard_trip", ...]`.
  4. Hang up.
- The parent never hears the unsafe phrase if the guard fires within ~200ms of detection (Twilio's audio buffer is ~150-200ms).

**Gate (behavioural):**
- 11-language fixture set: each fixture is a recorded audio clip whose transcript contains a forbidden phrase ("I am an AI", "Sahayak"). Assert the cut fires within 250ms of the forbidden token in at least 95% of clips.

### 2.5 Voice fixture recorder (2 days)

**Files:**
- `sahayakai-main/scripts/record-voice-fixtures.ts` — opens a fake Twilio session against a local sidecar in dev mode, replays a corpus of pre-recorded parent-speech audio clips (committed to `sahayakai-agents/tests/fixtures/voice/{lang}/{scenario}.mulaw`), captures the agent's audio response.
- 22 fixtures (2 turns × 11 languages), same scenario shape as Phase 1's text fixtures.

### 2.6 Voice parity comparator (3 days)

**Why:** Text parity (LaBSE) is necessary but not sufficient. Two replies with identical transcripts can sound different (pacing, prosody, accent). Voice parity adds an audio-embedding cosine on top.

**Files:**
- `sahayakai-agents/scripts/compare_voice_parity.py` — extends `compare_parity.py`'s two-phase model:
  - Phase 1 replay: same as text but over the voice sub-router.
  - Phase 2 score:
    - Tier 1: transcript LaBSE cosine (Phase 1's tier 2 reused).
    - Tier 2: audio embedding cosine (CLAP / WavLM-Base+).
    - Tier 3: Gemini-2.5-Pro LLM-judge over the rubric extended with `prosody_match` and `emotion_match`.

**Gate (CI):**
- Same drift-and-fail behaviour as `compare_parity.py`; the voice comparator runs in the GitHub Actions matrix only when `tests/fixtures/voice/` is present.

### 2.7 Cloud Run WS support + deploy (2 days)

**Notes:**
- Cloud Run supports WebSockets but with a 60-min connection cap. Long enough for any phone call we care about (cap parent calls at 8 minutes by `voice_session_max_seconds` env var, default 480).
- `service.yaml` `containerConcurrency` for the voice service is 1 — each WS holds the request-handler thread. Scaling is per-call.
- New service: `sahayakai-agents-voice` (separate from the batch service so resource scaling is independent).

**Files:**
- `sahayakai-agents/deploy/service-voice.yaml` — voice service spec.
- `sahayakai-agents/deploy/cloudbuild-voice.yaml` — voice service build pipeline.

### 2.8 Twilio TwiML route extension (1 day)

**Files:**
- `sahayakai-main/src/app/api/attendance/twiml/route.ts` — existing `mode=streaming` already wires to Pipecat. Add `mode=streaming-gemini-live` that points `<Stream url>` at the new sidecar voice service.
- `parentCallSidecarMode` extended with `'streaming'` literal. Dispatcher routes calls in this mode through the streaming path; falls back to the batch path on transport errors.

### 2.9 Track F: shadow ramp + cutover (10-14 days)

Same auto-abort wiring as Track D, plus two extra alert policies:
- `audio_first_byte_p95 > 1500ms` (15m).
- `voice_session_dropped_rate > 5%` (15m).

Ramp: `streaming@1% → 5% → 25% → 50% → 100%`. Hold 100% for 7 days before any Phase 1 dead-code removal.

## Risks

### High

- **Gemini Live regional availability** — only `us-central1` and `europe-west1` are GA at the time of writing. We are `asia-southeast1`. Either deploy the voice service in `us-central1` (cross-region latency ~80-100ms p95, eats half the latency budget) or wait for regional GA. **Mitigation:** spike measures cross-region latency in 2.0; if p95 > 250ms cross-region, defer Phase 2 until regional GA.
- **Audio format compatibility** — Twilio Media Streams send μ-law 8kHz; Gemini Live expects PCM 16kHz. Resampling adds ~5ms per frame; OK in steady state, but cold-start may push latency over budget.
- **Cost** — Gemini Live is ~3-5× more expensive per minute than Flash text inference. **Mitigation:** Phase 2 stays flag-gated; if cost overshoots we ramp back via auto-abort.

### Medium

- **Behavioural-guard cut UX** — if the guard cuts mid-sentence the parent hears a sudden audio gap. **Mitigation:** the canned safe wrap-up is audio-prefixed with a soft cross-fade; guard cut events tagged so we can offline-review for false positives.
- **WS connection cap on Cloud Run** — 60min max. An 8-min cap on parent calls keeps us well under.
- **Twilio inactive timeouts** — if the agent goes silent (e.g. waiting for a tool call) Twilio may close the stream. **Mitigation:** sidecar emits a 100ms "thinking" silence frame at 5s if no agent audio has been streamed.

### Low

- **Multi-region failover** — same as Phase 1, single-region for v1.
- **Voice fingerprinting privacy** — recordings of parent speech are sensitive. DPDP compliance: 24h TTL on `agent_voice_sessions`, no raw audio committed to source control beyond the synthetic fixture set.

## Estimated effort

- 2.0 design/spike: **1 week**
- 2.1 voice sub-router: **3-5 days**
- 2.2 Gemini Live broker: **3 days**
- 2.3 disconnect/resume: **2 days**
- 2.4 real-time guard: **2 days**
- 2.5 fixture recorder: **2 days**
- 2.6 voice parity: **3 days**
- 2.7 deploy: **2 days**
- 2.8 TwiML route: **1 day**
- 2.9 ramp: **10-14 days**

**Total: ~5-6 weeks of engineering + 2-week ramp = 7-8 weeks calendar.**

## Dependencies

- Phase 1 must be fully ramped to 100% on the batch path before Phase 2's first shadow flip — Phase 2 is built ON TOP of the batch sidecar (shares the prompt, the behavioural guard, the OCC layer, the auto-abort function).
- `google-genai` 1.73+ already pinned in Phase 1; Gemini Live API is in the same SDK.
- Cloud Run WS support — already GA since 2024 in our region.
- DPDP review of voice retention + cut-event logging — flag for legal before any fixture recording.

## Out-of-band gates

Before any traffic flips to `streaming` mode:

1. Cost dashboard built and 3-day baseline established.
2. Behavioural-guard partial cut tested live in shadow mode against >= 1000 calls; false-positive rate must be < 0.5%.
3. Twilio + Cloud Run WS combo proven stable across at least one mobile-network blip (chaos test from 2.3).
4. DPDP compliance sign-off on `agent_voice_sessions` retention.
5. Auto-abort extended with the two new voice-specific alert policies AND tested in dry-run mode.

## Files this plan implies (forward inventory)

```
sahayakai-agents/
  spikes/
    gemini-live/
      notebook.ipynb                        (2.0)
      latency_benchmark.py                  (2.0)
  src/sahayakai_agents/
    agents/parent_call/
      voice_router.py                       (2.1)
      voice_session.py                      (2.1, 2.3)
      audio.py                              (2.1)
      live_client.py                        (2.2)
      live_prompts.py                       (2.2)
    _behavioural.py                         (2.4 — extend)
  scripts/
    compare_voice_parity.py                 (2.6)
  deploy/
    service-voice.yaml                      (2.7)
    cloudbuild-voice.yaml                   (2.7)
  cloud_functions/auto_abort/
    policy_templates/
      07_audio_first_byte.yaml              (2.9)
      08_session_dropped.yaml               (2.9)
  tests/
    fixtures/voice/{lang}/{scenario}.mulaw  (2.5)
    integration/test_voice_router.py        (2.1)
    behavioral/test_partial_guard.py        (2.4)

sahayakai-main/
  scripts/
    record-voice-fixtures.ts                (2.5)
  src/lib/feature-flags.ts                  (2.8 — extend with 'streaming')
  src/app/api/attendance/twiml/route.ts     (2.8 — add streaming-gemini-live)
```

## Questions to resolve before kickoff

1. Does Gemini Live support all 11 of our parent languages with native Indic voices, or do we need to fall back to en for some? (Spike answers this.)
2. Is the 8-minute call cap aligned with parent-engagement data from Phase 1 production? (Pull from `agent_sessions` post-Phase-1 ramp.)
3. What is the Gemini Live unit cost as of GA? Track the published price list.
4. Should the voice service be a separate Cloud Run service or a separate path on the existing one? (Recommendation: separate; lets WS scaling be tuned independently.)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
