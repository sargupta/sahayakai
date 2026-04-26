# Phase 5 — VIDYA orchestrator on the ADK sidecar

## Headline

Move the VIDYA agent brain (intent classification + `instantAnswer`
composer) out of Genkit and into the Python ADK sidecar. Same
synchronous JSON contract the OmniOrb mic UI already speaks, same
two-Gemini-call cost cap, same `withPlanCheck('assistant')` wrapper on
the Next.js edge. Cache, session CRUD, profile CRUD, TTS, and STT all
stay where they are — the sidecar gets the brain, not the plumbing.

## §1. Why now / scope

### Why migrate VIDYA

1. **Consistency with Phase 1-3.** Parent-call, lesson-plan
   writer-evaluator-reviser, and lesson-plan RAG all live on the
   sidecar with shared resilience and behavioural guards. VIDYA on
   Genkit is now the odd one out — every reliability lever we add to
   the sidecar skips the agent teachers trigger most.

2. **Tool-using-agent vision.** Today's VIDYA is pure intent-classify +
   inline answer composer. ADK's `LlmAgent` + `tools=[]` API gives a
   clean migration path to a tool-using orchestrator later (Phase 6+):
   the agent could call `lesson_plan.generate` as a tool instead of
   asking the client to navigate. Phase 5 ships parity only; landing
   on the same runtime makes the future move a refactor inside one
   process, not a cross-language rewrite.

3. **Shared resilience.** The sidecar's `run_resiliently` wrapper
   gives us key rotation across `genai_keys`, telephony-bounded
   backoff capped at `max_total_backoff_seconds`, and a single
   observability spine. VIDYA's two model calls today get none of that
   — they run through Genkit's older retry path with no shared budget
   across the two calls.

### Scope IN

- The agent **brain**: the Gemini call that classifies intent + extracts
  parameters (the `intentPrompt` defined in
  `sahayakai-main/src/ai/flows/agent-definitions.ts:42-83`).
- The `instantAnswer` composer: the second Gemini call made when intent
  is `instantAnswer`. Today this lives in
  `sahayakai-main/src/ai/flows/instant-answer.ts:62+`. Phase 5 ports
  the composer prompt and the structured-output schema; it does **not**
  port the optional Google Search grounding (kept on Next.js — see
  §Scope OUT).
- The behavioural guard on the assistant's response text.
- Schema-validated `action` shape (flow name in allowed list, params
  bounded).

### Scope OUT

The following stay on Next.js — migrating them is risk for no benefit:

- **TTS** (`/api/tts`). Server route, not a model call.
- **STT** (Web Speech API). Client-side.
- **Session CRUD** (`/api/vidya/session/*`) and **profile CRUD**
  (`/api/vidya/profile`). Plain Firestore. Migrating forces a second
  Admin SDK setup and dual-writes during the ramp.
- **L2 Firestore intent cache.** Lookup runs in the dispatcher BEFORE
  the sidecar; write runs AFTER. Sidecar stays stateless w.r.t.
  cache.
- **Plan-check** (`withPlanCheck('assistant')` at
  `sahayakai-main/src/app/api/assistant/route.ts:242`). Stays as the
  route wrapper. Sidecar trusts the route.
- **Google Search grounding** for `instantAnswer`
  (`instant-answer.ts`). Sidecar returns a composed answer without
  grounding — small quality delta on live-fact questions, accepted
  to keep Phase 5 small. Grounding migration is Phase 6.

## §2. Architecture

### Endpoint

```
POST /v1/vidya/orchestrate
Authorization: Bearer <ID-Token-mint>     # same HMAC + ID-token mint as
X-Sahayakai-Signature: <hmac>             # parent-call / lesson-plan
Content-Type: application/json
```

Synchronous JSON. **No streaming.** The OmniOrb client at
`sahayakai-main/src/components/omni-orb.tsx` makes a single `fetch` to
`/api/assistant` and waits for the full response before either calling
TTS or routing the user. Introducing streaming now would force a
second client-side change (SSE handling, partial-response buffering)
for zero user-visible benefit — TTS still cannot start until the full
response text is in hand.

### Agent shape

A single `LlmAgent` with structured-output schema. **No ADK tools** —
the agent does not execute sub-flows. It returns an `action` shape
that the *Next.js dispatcher* uses to either:

- send the response text to TTS and let the client speak it (intent
  `instantAnswer`, intent `unknown`); or
- send the response text + a `NAVIGATE_AND_FILL` action to the client,
  which routes to the flow's page and pre-fills query params (the
  9 routable sub-flows: `lessonPlan`, `quiz`, `visualAid`, `worksheet`,
  `virtualFieldTrip`, `teacherTraining`, `rubric`, `examPaper`,
  `videoStoryteller`).

That separation is critical for §7 cross-service-loop risk: VIDYA on
the sidecar must NOT call back into the lesson-plan-on-sidecar path.
It returns navigation intent only.

### Two-call cap

```
Request
  │
  ▼
Render orchestrator prompt  ── pybars3 ──►  ⟦untrusted⟧ user message
  │                                          uiState, schoolContext
  ▼
Gemini call #1 (intent classify + params)  ──► IntentClassification
  │
  ├── intent != 'instantAnswer'  ──► assemble VidyaResponse, return
  │
  └── intent == 'instantAnswer':
        │
        ▼
        Render answer-composer prompt
        │
        ▼
        Gemini call #2 (compose answer)  ──► answer text
        │
        ▼
        assemble VidyaResponse with response=text, action=null
        │
        ▼
Behavioural guard (forbidden phrases, script match, action shape)
        │
        ▼
Return VidyaResponse
```

Total per request: max 2 Gemini calls. Same as Genkit today. Both
calls go through `run_resiliently` (one shared
`max_total_backoff_seconds` budget across both, the same way Phase 3's
4-call lesson-plan loop shares one budget).

### Cache + plan-check

- **L1 in-process Map — DROPPED.** Per-instance under Cloud Run
  autoscaling has near-zero hit ratio for non-warm pods.
- **L2 Firestore (`vidya_intent_cache/{md5}`) — KEPT.** Lookup +
  write run in `lib/sidecar/vidya-dispatch.ts`. Sidecar never touches
  the collection.
- **Session / profile writes** stay on Next.js — OmniOrb already
  fires them off independently of `/api/assistant`.
- **`withPlanCheck('assistant')`** keeps wrapping the route. The
  dispatcher runs INSIDE the wrapper. Sidecar does not re-check.

## §3. Sub-phases

### 5.1 Schemas (1 day)

Pydantic v2, `extra="forbid"`. Mirrors
`sahayakai-agents/src/sahayakai_agents/agents/lesson_plan/schemas.py`
style — bounded strings, `Field(min_length=, max_length=)` everywhere.

```
sahayakai-agents/src/sahayakai_agents/agents/vidya/schemas.py
```

Models:

- `VidyaRequest` — wire input.
  - `message: str` (1-4000 chars, the teacher's utterance).
  - `chatHistory: list[ChatTurn]` (max 30 turns; each turn is
    `{role, parts}` or `{user, ai, lang?}` — the union shape today's
    Next.js handler already accepts).
  - `currentScreenContext: ScreenContext | None`
    (`{path, uiState}`).
  - `teacherProfile: TeacherProfile | None`
    (preferred-grade / -subject / -language / school context).
  - `detectedLanguage: VidyaLanguage | None` (one of the 11 codes —
    same `Literal` set as lesson-plan).
  - `userId: str` (required for telemetry; bucketing happens in TS).
- `IntentClassification` — internal model output of call #1.
  - `intent: VidyaIntent` (the 11-value `Literal` mirroring
    `agent-definitions.ts:5-17`).
  - `topic: str | None`
  - `gradeLevel: str | None`
  - `subject: str | None`
  - `language: str | None`
- `VidyaAction` — wire output sub-shape.
  - `type: Literal["NAVIGATE_AND_FILL", "ANSWER", "NONE"]`
  - `flow: str | None` (the route key, e.g. `"lesson-plan"`)
  - `params: dict[str, str] | None` (bounded keys/values).
- `VidyaResponse` — wire output.
  - `response: str` (max 4000 chars).
  - `action: VidyaAction`
  - `language: str` (resolved language used for the response).
  - `sidecarVersion: str` / `latencyMs: int` / `modelUsed: str`
    (additive telemetry, same convention as `LessonPlanResponse`).

The `VidyaAction.flow` value is the **canonical route key** (one of:
`lesson-plan`, `quiz-generator`, `visual-aid-designer`,
`worksheet-wizard`, `virtual-field-trip`, `teacher-training`,
`rubric-generator`, `exam-paper`, `video-storyteller`). The
dispatcher converts that into the actual URL via the existing switch
in `agent-router.ts:31-72`.

### 5.2 Prompts (1 day)

Port the two Genkit prompts to Handlebars files used by both the
Python and Genkit fallback runtimes.

```
sahayakai-agents/prompts/vidya/orchestrator.handlebars
sahayakai-agents/prompts/vidya/instant_answer.handlebars
```

`orchestrator.handlebars` is the verbatim port of `intentPrompt` in
`sahayakai-main/src/ai/flows/agent-definitions.ts:42-83`. The Hindi /
mixed-script handling block, the parameter-extraction rules, and the
`SPECIAL INSTRUCTION FOR CONVERSATIONAL HINDI/URDU` carry over
unchanged. Plus a context block that today lives in the inline
template at `sahayakai-main/src/app/api/assistant/route.ts:168-173`:
the `CRITICAL CONTEXT INJECTION` section with screen path, UI state,
teacher profile, and language instruction.

`instant_answer.handlebars` is the answer-composer prompt — short,
structured, low-temperature. Same model
(`gemini-2.0-flash` or upgrade target), `temperature: 0.1` per
`route.ts:204`.

**Untrusted-input wrap (Wave 4 fix 3 convention).** The following
fields are user-controlled and MUST be wrapped in `⟦…⟧` markers
before being interpolated into the templates:

- `currentScreenContext.uiState` (form fields the teacher is editing
  — could be attacker-controlled if the teacher pastes hostile
  content into a worksheet textarea).
- `teacherProfile.schoolContext` (free-text profile field).
- `message` (the teacher's current utterance).

Same wrapping pattern lesson-plan's `writer.handlebars` already uses
for `teacherContext` and `topic`.

### 5.3 Agent helpers (1 day)

```
sahayakai-agents/src/sahayakai_agents/agents/vidya/agent.py
```

Mirrors `agents/lesson_plan/agent.py:46-114`:

- `_resolve_prompts_dir() -> Path` — `SAHAYAKAI_PROMPTS_DIR/vidya` in
  prod, repo fallback in dev.
- `load_orchestrator_prompt()` / `load_instant_answer_prompt()`.
- `_compiled(template_name)` with `@lru_cache(maxsize=2)`.
- `render_orchestrator_prompt(context: dict[str, Any]) -> str`.
- `render_instant_answer_prompt(context: dict[str, Any]) -> str`.
- `get_orchestrator_model()` / `get_instant_answer_model()` —
  `gemini-2.0-flash` default; env override
  (`SAHAYAKAI_VIDYA_ORCHESTRATOR_MODEL` /
  `SAHAYAKAI_VIDYA_INSTANT_ANSWER_MODEL`).
- `classify_action(verdict: IntentClassification) -> VidyaAction` —
  the gate logic. Validates the intent name is in the allowed list,
  the params are within type bounds, and constructs the
  `NAVIGATE_AND_FILL` action with the canonical flow key. For
  `instantAnswer` returns a placeholder action of
  `type="ANSWER"` (the second model call fills the response text).
  For `unknown` returns `type="NONE"`.

### 5.4 Router endpoint (2 days)

```
sahayakai-agents/src/sahayakai_agents/agents/vidya/router.py
```

Mirrors `agents/lesson_plan/router.py:18-244`:

```
POST /v1/vidya/orchestrate

  classification = _run_orchestrator(payload)        # call #1
  action = classify_action(classification)
  language = classification.language or payload.detectedLanguage or "en"

  if classification.intent == "instantAnswer":
      response_text = _run_instant_answer(payload, classification)   # call #2
  elif classification.intent == "unknown":
      response_text = _canned_fallback(language)
  else:
      response_text = _navigate_acknowledgement(classification, language)

  assert_vidya_response_rules(response_text, language, action)        # fail-closed
  return VidyaResponse(...)
```

Both Gemini calls wrap in `run_resiliently` and share the
`max_total_backoff_seconds` budget so a slow first call eats into
the second call's retry headroom — same pattern as the 4-call
lesson-plan loop.

`_canned_fallback(language)` returns a localised "I'm not sure how
to help — could you rephrase?" string in the resolved language so the
fallback path doesn't break the language lock.

### 5.5 Behavioural guard extension (1 day)

Extend `sahayakai-agents/src/sahayakai_agents/_behavioural.py`:

- `assert_vidya_response_rules(response_text, language, action)` —
  reuses `assert_no_forbidden_phrases` and
  `assert_script_matches_language` (no new regex), plus calls the
  new shape validator.
- `assert_vidya_action_shape(action)` — checks
  `action.flow in _ALLOWED_FLOWS` (the canonical 9-flow frozenset
  matching `agent-router.ts:31-72`) when `type == "NAVIGATE_AND_FILL"`;
  asserts `flow is None` and `params` is empty when `type` is
  `ANSWER` or `NONE`; raises on any other `type`. Catches LLM
  hallucination of an invented flow before navigation breaks.

### 5.6 Tests (3 days)

VIDYA has zero current tests. The migration is the right time to
backfill the missing scaffolding. Three layers:

**Unit** (in `sahayakai-agents/tests/unit/`):

- `test_vidya_schemas.py` — extra-fields-forbid for every new model;
  `VidyaAction` shape acceptance for all 11 intents × all valid
  param combinations.
- `test_vidya_render.py` — prompt renders with all required vars set;
  `⟦…⟧` markers appear around `message`, `uiState`, `schoolContext`.
- `test_classify_action.py` — gate logic: 9 routable intents each
  produce `NAVIGATE_AND_FILL`; `instantAnswer` produces `"ANSWER"`;
  `unknown` produces `"NONE"`; an invented intent raises.

**Integration** (in `sahayakai-agents/tests/integration/`):

- `test_vidya_router.py` — mocks `google.genai`. Intent
  classification matrix: 9 routable intents × 3 sample languages
  (en / hi / ta) = 27 fixtures asserting correct intent + flow key
  + params shape. Plus 11-language passthrough on one intent
  (`lessonPlan`) for the script-match guard. Plus 3 `instantAnswer`
  cases (en/hi/ta) verifying call-#2 fires. Plus 1 `unknown` case.
  Total ~42 fixtures — sampled, not exhaustive.

**Behavioural** (in `sahayakai-agents/tests/behavioral/`):

- `test_vidya_guard.py`:
  - Forbidden phrases (every `_FORBIDDEN_PATTERNS` regex) must trip
    `assert_vidya_response_rules`.
  - Script mismatch (Hindi response to a Hindi-language request that
    arrives in Latin script) must trip.
  - Action with `flow="invented-flow"` must trip
    `assert_vidya_action_shape`.
  - Action with `type="NAVIGATE_AND_FILL"` and `flow=None` must trip.
  - Action with `type="ANSWER"` and a non-None flow must trip.

**Pre-migration parity fixture.** Before §5.7 lands the dispatcher,
record a fixture file of the *current Genkit* responses on a fixed
set of 30 user utterances:

```
sahayakai-agents/tests/fixtures/vidya_genkit_baseline.json
```

Each entry: `{message, chatHistory, currentScreenContext, expected_intent, expected_flow, expected_params_keys}`.
The fixtures come from real production transcripts (anonymised, like
the lesson-plan baseline in §3.0). Captured by a one-time script
`scripts/record_vidya_baseline.py` that calls today's
`/api/assistant` and saves the responses. **Why this matters:** with
zero current tests, this fixture is the only behavioural-parity
baseline we have. Without it, the §5.7 dispatcher's shadow mode has
nothing to diff against.

### 5.7 TS dispatcher + flag (2 days)

Mirror `sahayakai-main/src/lib/sidecar/lesson-plan-{client,dispatch}.ts`:

```
sahayakai-main/src/lib/sidecar/vidya-client.ts
sahayakai-main/src/lib/sidecar/vidya-dispatch.ts
sahayakai-main/src/__tests__/lib/vidya-dispatch.test.ts
```

Feature flag — extend `FeatureFlagsConfig` in
`sahayakai-main/src/lib/feature-flags.ts`:

```ts
export type VidyaSidecarMode = 'off' | 'shadow' | 'canary' | 'full';

export interface FeatureFlagsConfig {
  vidyaSidecarMode: VidyaSidecarMode;
  vidyaSidecarPercent: number;          // 0-100, sticky on uid
}
```

`decideVidyaDispatch(uid)` deterministic uid-bucket — identical
shape to `decideLessonPlanDispatch(uid)`. Bucket on `uid` (not
`callSid`) because `/api/assistant` is authenticated.

Dispatcher responsibilities:

1. L2 cache lookup BEFORE the sidecar call — cache hits never
   reach the sidecar.
2. Forward to the sidecar on `canary` / `full` paths.
3. Fall back to Genkit on ANY sidecar error (timeout, HTTP, behavioural).
   Same policy as `lesson-plan-dispatch.ts:1-25` — Genkit path is
   non-redundant for VIDYA; teacher must get *some* response.
4. L2 cache write AFTER the sidecar (or Genkit fallback) succeeds
   on a fresh-query request.

### 5.8 Wire `/api/assistant` through the dispatcher (1 day)

Replace the inline Gemini call in
`sahayakai-main/src/app/api/assistant/route.ts:175-234` with a single
`dispatchVidya({...input, userId})` call. The route file stays small —
it owns:

- Plan-check wrapper
- Auth header → `userId` extraction
- Cache key + L2 lookup (delegated to dispatcher)
- Calling the dispatcher
- Returning the `VidyaResponse` as-is to the client

Default-on-merge: `vidyaSidecarMode = 'off'`. Production traffic stays
on Genkit until the rollout starts — same default-off-on-merge policy
as Phase 3.

## §4. Architectural decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Bucket on `uid` vs `callSid` | `uid` | VIDYA is HTTP-request-scoped with authenticated user; no Twilio call SID. Same bucket key as Phase 3. |
| Canary fallback on behavioural error | Genkit | VIDYA's Genkit path has its own behavioural guard with different rules — the two paths are not redundant. Teacher gets *some* response. (Different from parent-call where behavioural-fail rethrows.) |
| L1 cache | Drop | Per-instance Map under Cloud Run autoscaling has near-zero hit ratio for non-warm pods. Removing simplifies the contract. |
| L2 cache | Keep, move | Run lookup + write in the dispatcher. Sidecar stays stateless. |
| Streaming | No | Synchronous JSON contract is established; OmniOrb client expects it. SSE adds a client-side change for zero TTS-latency benefit (TTS waits for full text either way). |
| Session/profile CRUD | Skip | Plain Firestore CRUD, no model calls — no value to migrate. |
| Plan-check | Stays on Next.js | `withPlanCheck('assistant')` continues to wrap the route. Sidecar trusts the route. |
| Tools registered to `LlmAgent` | None | Sidecar returns navigation intent only. Cross-service-loop risk (§7) is the reason. |

## §5. Tests we have to backfill

VIDYA has zero current tests. Phase 5 ships the following test
scaffolding (full layout in §5.6):

- **Action-shape acceptance matrix** — every allowed flow ×
  representative param combinations × all 11 languages (the language
  dimension is sampled to en/hi/ta on the bulk matrix and exercises
  all 11 on a single-intent passthrough).
- **Intent classification matrix** — 27 representative requests
  spanning the 9 routable intents × 3 sample languages, plus 3
  `instantAnswer` cases, plus 1 `unknown` case.
- **Cache contract test** — Jest dispatcher test asserts:
  - L2 hit → no sidecar call, no Genkit call, returns cached.
  - L2 miss → sidecar called (or Genkit, per mode), then L2 written.
  - Multi-turn (`chatHistory.length > 0`) → cache layer skipped on
    both lookup and write.
- **Plan-check inheritance** — Jest test on `/api/assistant/route.ts`
  asserts `withPlanCheck('assistant')` still wraps the route after
  the dispatcher swap (call without auth → 401; call with auth →
  dispatcher reached).
- **Pre-migration parity baseline** — 30-fixture record from current
  Genkit traffic, captured in §5.6's `scripts/record_vidya_baseline.py`.
  This is the parity gate during shadow mode.

## §6. Rollout

Same off → shadow@5% → 25% → 50% → canary@5% → 25% → 50% → full
ladder as parent-call and lesson-plan. Each rung holds for 24 hours
minimum and 7 days maximum before promotion.

### Auto-abort thresholds (VIDYA-specific)

| Metric | Threshold (15m window) | Action |
| --- | --- | --- |
| Action-classification mismatch (sidecar vs Genkit) in shadow | > 5% | Demote one rung |
| Behavioural-guard 502 rate | > 0.5% | Demote one rung |
| p95 end-to-end latency (route entry → response) | > 3000 ms | Demote one rung |
| Sidecar 5xx rate | > 1% | Demote one rung |

The 3s p95 latency cap is tighter than lesson-plan's 12s budget —
VIDYA is voice-bound. The user is staring at the OmniOrb waiting for
TTS to start; anything over 3s on the response itself blows out the
total perceived latency once you add the TTS round-trip.

The "action-classification mismatch" metric is shadow-mode specific:
the dispatcher logs both the Genkit response and the sidecar response
on shadow-mode requests, computes a mismatch (different intent OR
different flow OR different params shape), and emits a counter. A
> 5% mismatch is the signal that the prompt port has drifted and the
sidecar is classifying differently than Genkit — demote and
investigate before promoting.

## §7. Risks

### High

- **Pre-migration parity baseline gap.** VIDYA has zero current
  tests. We cannot run the same parity-scoring rigor we did on
  parent-call (which had a behavioural test suite to anchor on).
  **Mitigation:** the §5.6 `record_vidya_baseline.py` script
  captures 30 production responses BEFORE the migration starts;
  shadow-mode dispatcher diffs against that baseline. The
  shadow@5% rung holds for at least 7 days so we accumulate a real
  production-traffic mismatch sample, not just the 30 fixtures.

- **Action shape evolution drift.** If Genkit and the sidecar drift
  on the action-type enum (e.g. someone adds `quizV2` to one side
  without the other), navigation breaks silently — the client gets
  an action it doesn't know how to route. **Mitigation:** a shared
  test fixture file
  (`sahayakai-agents/tests/fixtures/vidya_canonical_actions.json`)
  enumerates every allowed `(intent, flow, params_keys)` triple. The
  Python `assert_vidya_action_shape` AND a Jest test on the
  TypeScript dispatcher both load this file. CI fails if either side
  grows a new action without the other.

### Medium

- **Cache strategy change (L1 → L2-only).** Dropping L1 means a
  small drop in cache-hit-rate on the very first deploy as warm
  instances lose their in-process cache. **Mitigation:** acceptable
  because L1's per-instance hit ratio under autoscaling is already
  low. Telemetry counter on L2 hit-rate before / after the merge
  documents the actual delta.

- **Cross-service loop concern.** If VIDYA-on-sidecar were to
  *actually call* sub-agents (e.g. `lesson_plan.generate`) back into
  the lesson-plan-on-sidecar path, we'd have a round-trip
  Next.js → sidecar → Next.js → sidecar with two HMAC mints, two
  ID-token mints, and double the latency budget. **Today's VIDYA
  does NOT execute sub-flows — it only navigates the client to the
  flow page.** Phase 5 preserves that. Documenting the rule for
  future contributors: VIDYA-on-sidecar returns navigation intent
  only; it does NOT invoke `lesson_plan.generate` or any other
  sidecar route as a tool. That's a Phase 6+ design and requires a
  separate cross-service-loop budget design.

- **`instantAnswer` quality regression on live-fact questions.** The
  Genkit path optionally grounds with Google Search; the sidecar
  path does not (Phase 5 scope OUT). For "what time is sunset in
  Bengaluru today" the sidecar will hallucinate. **Mitigation:**
  during canary, route `instantAnswer` requests where the message
  contains live-fact triggers (today / current / now / latest) back
  to Genkit. A small server-side regex on the dispatcher. Phase 6
  ports grounding too; Phase 5 ships the regex hack.

### Low

- **L2 cache-write race in the dispatcher.** Cache lookup runs
  before the sidecar; the sidecar takes 600-2000 ms; cache write
  runs after. Two concurrent fresh queries with the same cache key
  could both miss and both write. **Mitigation:** writes are
  idempotent (same hash → same Firestore doc id → last-write-wins
  with the same content). Acceptable.

- **Untrusted-input wrap omission.** If we forget the `⟦…⟧`
  wrap around `message` or `schoolContext` on the sidecar
  (the Genkit path doesn't wrap at all today), prompt-injection
  vectors that exist on Genkit silently exist on the sidecar too.
  **Mitigation:** §5.2 calls out the wrap; §5.6 unit test
  `test_vidya_render.py` asserts the markers appear around all
  three fields.

## §8. Cost model

### Per request

- 1 intent-classify Gemini call (`gemini-2.0-flash`) ≈ $0.0001-0.0003
  per call (depending on chatHistory length).
- IF `instantAnswer`: + 1 answer-compose Gemini call ≈
  $0.0001-0.0005.
- Behavioural guard + prompt rendering on the Python side: free
  (in-process).
- Sidecar overhead (HMAC sign, ID-token mint, network RTT to
  `asia-southeast1` Cloud Run): negligible.

**Net Phase 5 cost change: ~0%.** Same 2-call cap as Genkit today.

### Cloud Run sidecar

VIDYA traffic at current production volume is ~100-500 calls/day per
active teacher. With the existing `minScale=1` Cloud Run config the
sidecar is already warm; VIDYA traffic adds CPU minutes well within
the existing instance budget. No new Cloud Run revisions or scale
config needed.

### One-time

Test fixture capture script (`scripts/record_vidya_baseline.py`):
~30 calls × $0.0003 = **~$0.01.** Negligible.

## Files this plan implies

```
sahayakai-agents/
  src/sahayakai_agents/
    agents/vidya/
      __init__.py
      schemas.py
      agent.py
      router.py
    _behavioural.py                     (extend with VIDYA helpers)
  prompts/vidya/
    orchestrator.handlebars
    instant_answer.handlebars
  scripts/
    record_vidya_baseline.py
  tests/
    fixtures/
      vidya_genkit_baseline.json
      vidya_canonical_actions.json
    unit/
      test_vidya_schemas.py
      test_vidya_render.py
      test_classify_action.py
    integration/
      test_vidya_router.py
    behavioral/
      test_vidya_guard.py

sahayakai-main/
  src/lib/sidecar/
    vidya-client.ts
    vidya-dispatch.ts
  src/lib/feature-flags.ts              (extend with vidyaSidecar*)
  src/__tests__/lib/
    vidya-dispatch.test.ts
  src/app/api/assistant/route.ts        (route through dispatcher)
```

## Pre-kickoff gates

1. Phase 3 lesson-plan path at 100% in production for ≥ 14 days with
   no auto-abort fires.
2. `vidya_genkit_baseline.json` fixture committed (30 production
   responses captured by `record_vidya_baseline.py`).
3. `vidya_canonical_actions.json` shared fixture committed; CI on
   both Python and TypeScript loads it.
4. Sidecar Cloud Run service has headroom — verify
   `/v1/lesson-plan/generate` p95 < 8s under current traffic before
   adding VIDYA load.

## Estimated effort

- 5.1 schemas: **1 day**
- 5.2 prompts: **1 day**
- 5.3 agent helpers: **1 day**
- 5.4 router endpoint: **2 days**
- 5.5 behavioural guard: **1 day**
- 5.6 tests + baseline capture: **3 days**
- 5.7 TS dispatcher + flag: **2 days**
- 5.8 wire `/api/assistant`: **1 day**
- Ramp: **10-14 days**

**Total: ~2 weeks engineering + 2-week ramp = 4 weeks calendar.**

## Dependencies

- Phase 3 + Phase 4 must be ramped before this kicks off so the
  dispatcher pattern, shared fixture format, and `run_resiliently`
  budget convention are battle-tested.
- The shared `evaluation/scorers.py` extracted in Phase 3.0 is
  available for shadow-mode parity scoring (cosine, IndicSBERT,
  Gemini-judge) over the 30-fixture baseline.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
