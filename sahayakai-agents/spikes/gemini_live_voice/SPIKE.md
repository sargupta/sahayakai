# Gemini Live API for VIDYA Voice Mode (Spike)

Phase S — architectural spike, NOT a production migration.
Branch: `feature/phase-n-through-t`.

The biggest architectural lever Firebase exposed in 2026 is
**Gemini Live API** — bidirectional audio streaming over a single
WebSocket session. It collapses the multi-call typed pipeline that
powers VIDYA today into one streaming exchange.

This spike proves the integration shape end-to-end. The production
OmniOrb path is not touched.

---

## Current pipeline (latency ~3-8s per request)

```
mic
  └─► /api/voice-to-text          (Gemini multimodal,        ~1-2s)
        └─► /api/assistant         (vidya orchestrator,        ~1-2s)
              ├─ if instantAnswer: another Gemini call         (~1-3s)
              └─► /api/tts          (Google Cloud TTS Neural2,  ~1s)
                    └─► audio plays in browser
```

Five sequential network hops. Each adds RTT + a model cold-call.
p50 ~3s, p95 ~8s, with the worst latencies on long instant-answer
prompts in low-bandwidth regions (Tier-2/3 schools).

The teacher is told the orb is a "voice assistant" — they expect
sub-second turn-taking. The current pipeline fails that promise.

---

## Proposed pipeline (latency ~500ms first-byte)

```
mic
  ├─► OmniOrb opens WSS direct to Gemini Live
  ├─◄ Live streams audio chunks back as speech is generated
  └─◄ Tool calls (NAVIGATE_AND_FILL) returned inline as Live events
```

One WebSocket. Audio in, audio + tool events out. Tool calls trigger
the existing 9-flow `NAVIGATE_AND_FILL` action — no schema change
on the client dispatcher.

Realistic targets per the SDK reference + Track-S 30-agent review:
- p50 first-byte: ~500ms
- p95 first-byte: ~1500ms (honest expectation)
- Mid-utterance interruption: <250ms (Live's barge-in)

---

## Architecture

```
┌──────────────┐    POST /v1/vidya-voice/         ┌─────────────────┐
│   OmniOrb    │ ──── start-session ────────────► │  sahayakai-     │
│  (browser)   │                                   │  agents sidecar │
│              │ ◄── ephemeral token + WSS URL ── │                 │
│              │                                   │                 │
│              │   WSS direct to Live API          │ Master Gemini   │
│              │ ═════════════════════════════════│ key NEVER       │
│              │   (audio + tool events)           │ leaves Cloud Run│
└──────────────┘                                   └─────────────────┘
       │                                                     │
       │          WSS                                        │
       ▼                                                     │
┌──────────────────────┐                                     │
│  Gemini Live API     │ ◄────────── auth_tokens.create ─────┘
│  (bidi streaming)    │              (per-session, 60s TTL,
└──────────────────────┘               bound to model + tools)
```

Key decisions:

| Decision | Why |
|---|---|
| Sidecar mints, browser connects | Master Gemini key never leaves Cloud Run. Token TTL is short (60s) and bound to one specific Live config — leaked tokens have low blast radius. |
| Audio bytes do NOT proxy through sidecar | Every extra hop adds 50-100ms RTT. The 500ms first-byte target only works if mic↔Live is one network leg. Also: keeps Cloud Run pod CPU + bandwidth costs unchanged. |
| Tools = the existing 9 NAVIGATE_AND_FILL flows | No client dispatcher rewrite. Live tool events map 1:1 to today's `VidyaAction` shape. The system instruction tells the model when to call a tool vs when to answer in voice. |
| Token bound to LiveConnectConstraints | Even if a token leaks, attacker can't repurpose it for a different model with a different system instruction. `lock_additional_fields=["model","config"]` enforces this server-side. |
| Phase S scope is sidecar + spike React component | No production traffic. No feature flag yet. Ships as `vidya_voice_router` parallel to `vidya_router`. |

---

## Wire contract

### POST /v1/vidya-voice/start-session

Request — same auth as `/v1/vidya/orchestrate` (Firebase ID token →
sidecar HMAC). Body:

```jsonc
{
  "teacherProfile": {
    "preferredGrade": "Class 5",
    "preferredSubject": "Science",
    "preferredLanguage": "en",
    "schoolContext": "rural government school"
  },
  "currentScreenContext": { "path": "/dashboard", "uiState": null },
  "detectedLanguage": "en"
}
```

Response:

```jsonc
{
  "sessionToken": "<opaque ephemeral token>",
  "wssUrl": "wss://generativelanguage.googleapis.com/ws/.../BidiGenerateContent",
  "expiresInSeconds": 60,
  "sessionConfig": {
    "model":              "gemini-live-2.5-flash-preview",
    "voice":              "Aoede",
    "responseModalities": ["AUDIO"],
    "languageCode":       "en"
  },
  "tools": [
    { "name": "open_lesson_plan",      "flow": "lesson-plan",      "description": "..." },
    { "name": "open_quiz_generator",   "flow": "quiz-generator",   "description": "..." },
    /* ... 7 more ... */
  ],
  "sidecarVersion": "phase-s.0.0-spike",
  "spike": true
}
```

Client then opens `wssUrl?access_token=<sessionToken>`, sends a
`setup` frame containing `tools` (mapped to Live function-calling),
and starts streaming audio.

---

## Tool surface (9 flows)

Re-uses the existing VIDYA `AllowedFlow` enum. Each flow becomes one
Live tool. The Live model emits a tool call instead of speaking when
the teacher's intent matches:

| Live tool | NAVIGATE_AND_FILL flow |
|---|---|
| `open_lesson_plan`           | `lesson-plan`           |
| `open_quiz_generator`        | `quiz-generator`        |
| `open_visual_aid_designer`   | `visual-aid-designer`   |
| `open_worksheet_wizard`      | `worksheet-wizard`      |
| `open_virtual_field_trip`    | `virtual-field-trip`    |
| `open_teacher_training`      | `teacher-training`      |
| `open_rubric_generator`      | `rubric-generator`      |
| `open_exam_paper`            | `exam-paper`            |
| `open_video_storyteller`     | `video-storyteller`     |

Tool params (`topic`, `gradeLevel`, `subject`, `language`) match the
existing `VidyaActionParams`. Client dispatcher needs zero changes
to handle the Live → router transition.

---

## Migration plan

### Phase S.1 — Spike (this PR)
- New router: `POST /v1/vidya-voice/start-session`.
- Pure session-manager: mints ephemeral token, hands back WSS URL +
  tool list. Audio never touches the sidecar.
- React component `omni-orb-live.tsx` proves browser-side integration
  shape. Untested in CI; documented as spike.
- Three integration tests (happy path / Hindi / token-mint failure).

**Acceptance gates** before moving to Phase S.2:
- [ ] Can the sidecar mint an ephemeral token in production?
      (`auth_tokens.create()` requires the Live API to be enabled on
      the project. The 502 path documents this if it isn't.)
- [ ] Does Gemini Live actually serve `asia-southeast1` traffic?
      Or does first-byte cross-region exceed 1500ms p95?
- [ ] Can the browser open the WSS handshake before the 60s TTL?
      (Hostile-network teachers in Tier-3 schools may not.)
- [ ] Does the Aoede voice handle Indic-language pronunciation as
      well as our existing Cloud TTS Neural2 (hi/en) + Wavenet
      (bn/ta/kn/ml/gu/pa) + Standard (te) stack?

### Phase S.2 — Feature flag
- Add `voice_mode` field to teacher profile: `"legacy" | "live"`.
- Hardcode 100% of teachers to `legacy`.
- Surface `voice_mode` in `OmniOrb` so internal builds (Abhishek's
  account, dogfood SAs) can flip to `live` and exercise the spike
  end-to-end.

### Phase S.3 — Shadow mode
- For 1% of teachers (allow-listed), open BOTH pipelines on every
  voice turn.
- Record:
  - Latency: typed-pipeline first-audio-byte vs Live first-byte.
  - Quality: side-by-side audio playback in an internal review tool.
  - Tool-call accuracy: did Live's tool call match what the typed
    classifier produced?
  - Cost: sidecar tokens (typed) vs Live audio-minute pricing.
- Decision gate: ship Phase S.4 only if:
  - p95 first-byte < 1500ms (the honest expectation, not 800ms target)
  - Tool-call accuracy >= 95% of typed classifier
  - Quality reviewers (3 internal teachers) pick Live > typed
    on ≥ 60% of A/B comparisons
  - Cost projection within 2× of typed pipeline per teacher-month

### Phase S.4 — Canary
- 5% of teachers → `voice_mode: "live"` (allow-listed by school).
- 24h soak. Watch p95 latency, error rate, behavioural-guard fires
  (Live needs a streaming guard; see Phase 2 spike `gemini_live/`
  for the `with-guard` benchmark).
- 25% → 100% over 7 days, gated on the same metrics.
- Old typed path stays in code as `voice_mode: "legacy"` until
  Phase S.4 hits 100% × 14 days, then the typed path retires.

---

## Outstanding risks (DO NOT skip in production migration)

These are in the PG Pressure Test honest-doc category. The spike
ships even though each is unresolved — they're surfaced here so the
production migration can't quietly inherit them.

1. **Behavioural guard on partial transcripts.** The typed pipeline
   guards the FULL response text. Live streams audio token-by-token;
   the guard has to fire mid-utterance and barge-in if it detects an
   identity-rule violation. Phase 2 spike `gemini_live/` already
   prototyped this with a 250ms cut-fire target — the migration must
   reuse that guard, not write a new one.

2. **Voice quality vs Cloud TTS Neural2.** Our current Hindi voice
   is Neural2 — the gold-standard Indian-accent TTS. Aoede is
   multilingual but NOT trained specifically on Indian accents. A
   side-by-side blind A/B with three native-Hindi-speaking teachers
   gates Phase S.4.

3. **Cost per teacher-month.** Live audio-minute pricing differs
   from per-token typed pricing. Without a Phase S.3 shadow-mode
   measurement we don't know whether Live is cheaper or more
   expensive per teacher (the SDK docs hint at "comparable" but
   that's not a budget commitment).

4. **Region availability.** Live preview is rolling out region-by-
   region. As of Apr 2026 `asia-southeast1` IS supported, but Phase
   2 spike's open question — does `asia-south1` (post-DPDP) get GA
   Live? — is still unanswered. If Phase S.4 ships before
   `asia-south1` GA, every Live session crosses regions.

5. **Reconnect / resume.** Mobile teachers walking between WiFi APs
   drop the WSS. The spike does NOT handle resume. Phase 2 §2.3
   covers session resumption — production migration MUST integrate
   that work.

6. **DPDP + audio retention.** Audio bytes flow direct between the
   browser and Google. Our Firestore audit trail (which the typed
   pipeline writes to) does NOT capture the audio. DPDP review needs
   to clear the new data flow before Phase S.4.

---

## Files in this PR

- `sahayakai-agents/src/sahayakai_agents/agents/vidya_voice/`
  - `__init__.py` — exports + module docstring
  - `agent.py` — pure builder for the Live config + tool surface
  - `router.py` — `POST /v1/vidya-voice/start-session`
  - `schemas.py` — Pydantic wire contract
- `sahayakai-agents/tests/integration/test_vidya_voice_router.py`
  — 3 integration tests
- `sahayakai-main/src/components/omni-orb-live.tsx`
  — minimal React component, ~150 lines, untested

---

## Status

- [x] Sidecar router builds against the real `google-genai` SDK
      (`auth_tokens.create`, `LiveConnectConstraints` exist on
      version 1.73+).
- [x] Integration tests pass with the SDK mocked.
- [x] React spike component compiles with `tsc --noEmit`.
- [ ] End-to-end with a real Gemini API key — runs only on the
      developer's machine (out of scope for CI).
- [ ] Latency benchmark (Phase 2 spike `gemini_live/` covers the
      audio-conversion and first-byte numbers; this spike does NOT
      re-measure them).
