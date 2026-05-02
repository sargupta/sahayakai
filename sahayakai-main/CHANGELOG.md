# SahayakAI Changelog

All notable changes to the SahayakAI platform are tracked here.
Format derived from [Keep a Changelog](https://keepachangelog.com/),
versioning aligns with the AI agent migration phases (B - U).

---

## [Unreleased] — Forensic Remediation Sprint (PRs #21, #23, #24)

These three independent PRs land first. Each is small, low-risk, and
unblocks separate concerns.

### Fixed
- **Auth pipeline regression** [#21] — magic-link returning users no
  longer bounce to `/onboarding`. Two bugs:
  - `HomePage` flashed `LandingPage` during the brief unauth window
    between magic-link click and Firebase ID-token resolve. Now
    suppressed via a `sessionStorage` pending-signin flag set by the
    redirect handler.
  - `/api/auth/profile-check` conflated "user doc exists" with
    "onboarding complete". Returning users with partial profiles
    bounced to onboarding every login. Response shape now splits
    these: `{exists, onboardingComplete}`.
- **Sentence-count regex** [#23] — `_behavioural.count_sentences()`
  now correctly counts ASCII `...` (3+ dots) as a single ender,
  matching the existing `…` (U+2026) handling. 2 new unit tests.
- **Jest ESM transforms** [#24] — fixed 16 of 28 pre-existing test
  failures by adjusting `transformIgnorePatterns` and adding
  cross-suite mocks for `firebase-admin`, `firebase-admin/firestore`,
  `firebase/database`, `@/context/language-context`, `idb`. Test
  count: 549 / 577 → **615 / 627** passing. The 12 remaining failures
  are all assertion drift (component implementations changed but
  tests weren't updated) — explicitly out of ESM-fix scope.

---

## [Phase U] — 5-Expert ADK Cleanup [#22]

Final cleanup of the forensic remediation. **All 16 sidecar routers
are now ADK-native** (was 9 of 16 at start of Phase U).

### Added
- **`parent_message`, `rubric`, `teacher_training`** promoted to ADK
  `LlmAgent` (Expert α) — 15 new unit tests
- **`virtual_field_trip`, `video_storyteller`, `worksheet`** promoted
  to ADK `LlmAgent` (Expert β) — 15 new unit tests
- **`exam_paper`** promoted to ADK `LlmAgent` with post-Runner Python
  validator (Expert γ) — 7 new unit tests. Chose LlmAgent over
  SequentialAgent-with-LLM-validator because marks-balance is pure
  arithmetic; LLM validator would waste tokens and let the model lie
  about its own math.

### Changed
- **TS schema codegen migration** (Expert δ) — 11 hand-typed `*-client.ts`
  files now import wire types from `types.generated.ts` (regenerated
  from Pydantic source via `scripts/codegen_ts.py`). Drift between TS
  and Python schemas eliminated.
- **App Check token auto-injection** (Expert δ) — every sidecar client
  call site now auto-fetches a Firebase App Check token via
  `getFirebaseAppCheckToken()` when caller doesn't pass one. Server-side
  callers (cron jobs, Twilio callbacks) silently omit the header.
- **`vidya-dispatch.ts` propagates `plannedActions`** through
  `DispatchedVidya` shape (Expert δ) — OmniOrb client can now render
  compound-intent chips end-to-end.
- **Genkit `agentRouterFlow` parity** (Expert ε) — Node-side
  `outputSchema` migrated from `followUpSuggestion: string` to
  `plannedActions: list[VidyaAction]` (max 3) with 30-day legacy shim.
  `processAgentRequest` reads `plannedActions[0]` as primary; legacy
  string emits a deprecation warn.

### Test count
- Python sidecar: 681 → **719 passed**, 1 skipped (+38)
- TS dispatcher: 415 → **418 passed** (+3)

---

## [Phase N+M.3+M.5+O+P+Q.2+Q.3+R+S+T] — Forensic Remediation + Firebase Tier-1+2 [#20]

Closes all remaining forensic-audit items + ships 3 new Firebase
capabilities scaffolds.

### Added
- **Firebase App Check** [R.2] — 3-layer auth chain (App Check + ID
  token + HMAC body digest with replay nonce). Optional via
  `SAHAYAKAI_REQUIRE_APP_CHECK` env, defaults off in dev for local
  testing.
- **Genkit-style eval framework** [R.3] — 100 golden-set entries × 6
  narrative agents × 4 scorers (safety, language match, length, LaBSE
  similarity with Jaccard fallback). CLI runner: `uv run python -m
  evals.run_evals --agent <name>`.
- **Gemini Live API spike** [S] — `/v1/vidya-voice/start-session`
  mints ephemeral session tokens; OmniOrb client connects directly
  to Live API for ~500ms voice latency (vs current ~3-8s typed
  pipeline). Sidecar acts as session-manager only, audio never
  traverses our infrastructure.
- **Flutter app scaffolding** [T] — `sahayakai-flutter/` with 3 agents
  wired to Firebase AI Logic for hybrid inference (Gemini Nano
  on-device + cloud fallback). Awaiting `useHybridInference` SDK
  feature; staged behind constant flag.
- **`plannedActions: list[VidyaAction]`** [N.1] — typed compound-intent
  workflow plan (max 3 actions, max 2 `dependsOn` indices each).
  Replaces single-string `followUpSuggestion`. `AGENT_CARD_VERSION`
  bumped 0.3.0 → 0.4.0.
- **TypeScript schema codegen** [N.2] — `scripts/codegen_ts.py` emits
  OpenAPI from FastAPI app, runs `datamodel-codegen` to produce TS
  interfaces, writes to `dist/types.generated.ts`. CI drift check
  wired.
- **Per-call image timeout** [M.3] — image agents (visual-aid, avatar)
  bumped from 90s to 120s `_IMAGE_TIMEOUT_S` with `max_total_backoff_seconds=4.0`
  override. One retry max on $0.04/image cost.
- **Generic shadow-diff aggregator** [M.5] —
  `src/lib/sidecar/shadow-diff-writer.ts` generic helper +
  `aggregate_shadow_diffs.py` script for offline parity rollup
  (TF cosine + language match + JSON shape match + optional
  semantic cosine). 14 dispatchers wired.
- **`request_id` propagation** [P] — middleware mints UUID per
  request, propagates through Next.js → sidecar → ai_resilience
  events. Token + cache + latency metrics now joinable per-request.
- **Per-router token telemetry** [P] — 9 of 15 routers emit
  `model_used` + `tokens_in/out/cached`. ADK Runner-based routers
  emit None (Runner masks raw result) but counts still flow via
  `ai_resilience.attempt_succeeded` events keyed by same
  `request_id`.
- **66 language-parametrized integration tests** [O.1] — 11 Indic
  languages × 6 narrative agents. CI catches Hindi-specific
  regressions automatically.
- **29 size-boundary tests** [O.2] — image/audio/text 0-byte,
  max-1, max, max+1.
- **35 missing TS dispatcher fallback tests** [O.3] — 9 of 14
  dispatchers had no canary→genkit fallback test coverage.
- **4 ADRs** [Q.2] — in-process supervisor delegation, 4-mode
  dispatcher pattern, Firestore flag plane, no-default Pydantic.
- **15 per-agent capability sheets** [Q.3] —
  `scripts/generate_capability_docs.py` produces markdown from
  registry + Pydantic schemas + Handlebars templates + behavioural
  guards.

### Changed
- **Default model `gemini-2.0-flash` → `gemini-2.5-flash`** [R.1]
  on 11 agents. Pre-empts the June 2026 EOL on `gemini-2.0-flash`.

### Test count
- Python sidecar: 555 → **681 passed** (+126)

---

## [Phase L+M+Q.1] — ADK Workflow Refactors + Cost Split + README Sync [#19]

The architectural cleanup. Verdict from forensic audit before this:
"system imports `google-adk` but does NOT use it." After: 9 of 15
routers ADK-native (the remaining 6 promoted in Phase U).

### Changed
- **VIDYA orchestrator** is now a real `LlmAgent` + `Runner.run_async`
  invocation (was a hand-rolled `if intent.type ==` switch firing
  `google.genai` directly).
- **`instant-answer`** wrapped as `AgentTool` factory; VIDYA delegates
  via the public `run_answerer` (was a private cross-module import
  with placeholder `userId="vidya-supervisor"` hack).
- **`lesson-plan`** runs as a `LoopAgent` with state-emitting
  BaseAgent sub-agents (writer → evaluator → reviser). Replaces a
  procedural Python loop the file's own header admitted was
  non-canonical.
- **`quiz`** runs as a `ParallelAgent` with 3 difficulty variants,
  per-variant `output_key` to prevent shared-state races.
- **`visual-aid`, `avatar-generator`, `voice-to-text`** run as
  `SequentialAgent`s. Wire shape unchanged; ADK provides per-sub-agent
  tracing + state passing.
- **`video-storyteller` cost trap closed** [M.1] — extracted
  `getVideoCategorySearchResults` (YouTube only, no Gemini) from
  `getVideoRecommendations` (AI + YouTube). Sidecar mode no longer
  doubles AI spend. Was a permanent +100% LLM cost on every
  canary/full call.
- **VIDYA timeout 8s → 12s** [M.2] — `7s run_resiliently + 2s p50 +
  1s network` was guaranteed to timeout at p99. Tightened Python
  backoff to 5s so total budget stays ≤10s; TS gives 12s with 2s
  network buffer.
- **README rewrite** [Q.1] — 65 → 168 lines. Reflects 15-agent reality
  (was Phase-1 parent-call-only). Agent inventory, supervisor
  pattern, A2A 0.3 protocol, behavioural guard, env-var reference,
  deploy pointer, phase progress.

### Test count
- Python sidecar: 497 → **555 passed** (+58)

---

## [Phase K] — Persistence + Rate-limit + Safety Gates Lifted [#18]

Closes forensic-audit P0 #2: sidecar canary/full mode silently
dropped Storage persistence + rate-limits + safety + usage-tracking
on 9 of 15 flows.

### Changed
- 9 dispatchers now persist sidecar output to Cloud Storage
  (`users/{uid}/{collection}/{ts}_{slug}.{ext}`) + Firestore
  content-doc (matches Genkit flow's existing schema).
- Pre-call `checkServerRateLimit` / `checkImageRateLimit` lifted
  from inside Genkit flows into the dispatcher, so sidecar-routed
  calls cannot bypass abuse limits.
- New `persist-helpers.ts` with `persistSidecarJSON` +
  `persistSidecarImage`. Fail-soft contract: a Storage / Firestore
  failure is logged but never propagates (the user already received
  a usable response from the sidecar; dropping it is worse than
  missing the library entry).

### Test count
- TS dispatcher: 549 → **615 passed** (+66) **after** [#24]'s ESM
  transform fix; without it the tests pass independently.

---

## [Phase J] — Hot Fixes: 10 P0 Deploy Blockers [#17]

Forensic audit's deploy-blocker batch. After this lands, the sidecar
is **physically capable of serving traffic** (was blocked by
`timeoutSeconds=8` and 4 other infra-level holes).

### Fixed
- **Cloud Run `timeoutSeconds: 8 → 120`** [J.1] — visual-aid + avatar
  90s, voice-to-text 60s, lesson-plan multi-stage all exceeded 8s.
  First canary user would have seen 100% 504. Closed.
- **A2A `protocolVersion: "0.2" → "0.3"`** [J.1] — spec was 0.3.0;
  our smoke script already said v0.3 spec; code disagreed.
  `AGENT_CARD_VERSION` 0.2.0 → 0.3.0.
- **`run_resiliently` per-call `asyncio.wait_for`** [J.2] — was
  unbounded ~600s. New `per_call_timeout_seconds` parameter.
- **All 14 dispatchers' Genkit fallback wrapped in `withTimeout`**
  [J.2] — closes the ~670s zombie path (sidecar 70s + Genkit 600s).
- **`_sanitize_for_prompt` lifted to `shared/prompt_safety.py`** [J.3]
  — applied to 13 routers (was only `parent_call`). The `⟦…⟧`
  markers in 13 other agents' templates were decorative.
- **`_CONFUSABLE_FOLD` extended** [J.3] — Mathematical Bold
  (U+1D400+), Cherokee, Armenian, plus split-letter injection
  defense. Reply `"𝐈 𝐚𝐦 𝐚𝐧 𝐀𝐈"` no longer bypasses
  forbidden-phrase scan.
- **Pydantic `list[str]` element bounds** [J.4] — `materials`,
  `objectives`, `chapters`, `generalInstructions` were bounded list
  but unbounded element. 150MB POST validated cleanly. Now
  per-element `max_length` bounds.
- **HMAC replay nonce store** [J.4] — `TTLCache(maxsize=10_000,
  ttl=360)` on `(timestamp, digest)`. Replay returns 409 with
  `auth.hmac.replay_detected` log event.
- **All 12 env-flagged dispatchers migrated to Firestore feature-flags
  plane** [J.5] — auto-abort Cloud Function (which only writes
  Firestore) can now roll back every agent. Was: 12 of 15 flags
  survived emergency rollback.
- **`LessonPlanRequest.userId` made required** [J.4] — was optional
  while every other agent's userId required. Inconsistency closed.

### Test count
- Python sidecar: 444 → **497 passed** (+53)

---

## [Phase I] — voice-to-text ADK Migration (Last Genkit Flow) [#16]

The last AI flow leaves Genkit. Every teacher-facing AI surface
now routes through the Python ADK sidecar.

### Added
- **`POST /v1/voice-to-text/transcribe`** — multimodal Gemini call
  (text rubric + audio bytes via `Part.from_bytes`). MIME allow-list
  (webm / mp4 / mpeg / wav / aac / flac / ogg). 60s `asyncio.wait_for`
  timeout. Behavioural guard: language ISO allow-list + forbidden-phrase
  scan.
- voice-to-text registered in supervisor's `INLINE_AGENTS` (it's a
  tool the OmniOrb invokes directly, not a navigation route).

---

## [Phases B-H] — 13 Earlier Migrations [#11 → #15]

The bulk of the forensic remediation's prerequisite work.

- **Phase B** [PR #10, merged earlier] — `instant-answer` ADK agent
  + VIDYA delegation hook
- **Phase C** [#11] — `parent-message-generator` ADK migration
- **Phase D** [#12] — rubric, teacher-training, virtual-field-trip,
  worksheet ADK migration
- **Phase E** [#13] — quiz (3-variant), exam-paper, visual-aid ADK
  migration
- **Phase F** [#14] — video-storyteller, avatar-generator ADK
  migration
- **Phase G** [#15] — VIDYA supervisor + multi-step compound-intent
  recognition (`followUpSuggestion`, replaced by `plannedActions` in
  Phase N.1)
- **Phase H** [#15] — A2A card hardening (`protocolVersion`,
  `securitySchemes`, registry-driven 14 skills)

PRs #11/#12/#13 are nested (each contains the previous). Recommended
merge: close #11 + #12, merge #13 alone.

---

## Merge order recommended

1. **#21** — auth fix (independent, 3 files, closes user-reported magic-link bug)
2. **#23** — sentence regex (independent, 3 files)
3. **#24** — Jest ESM fix (independent, 2 files, +66 tests passing)
4. **#9** — eslint flat config (already CI-green; lands directly)
5. **#13** — close #11 + #12, merge #13 alone (delivers Phase C+D+E)
6. **#14, #15, #16, #17, #18, #19, #20, #22** — sequential

Each merge after #13 is a fast-forward or near-no-op.

## Risks at merge time

- **`middleware.ts` overlap** between develop's iPhone Safari ITP fix
  and #20's App Check. `git merge-tree` says clean, but eyeball
  before #20 lands and test on iPhone Safari sign-in after.
- **Cloudflare Pages "FAILURE"** status on every PR is preview-deploy
  noise, not gating.
- **PR #20 diff > 20k lines** — split-review by directory required:
  `sahayakai-agents/`, `sahayakai-main/`, `sahayakai-flutter/`.

---

## What's still deferred (out of one-session scope)

- Multi-region DR (single `asia-southeast1` today)
- RAG over NCERT + state-board corpus (separate plan)
- Real Sarvam STT fallback (currently scaffolded but not integrated)
- Locust / k6 load tests
- Vidya inline `_KeyedGemini` dedupe (waits on phase-L merging)
- `followUpSuggestion` 30-day legacy shim removal (calendar gate)
- 12 remaining Jest assertion-drift fixes (component class names)
- Cloud Build deploy + IAM bootstrap (human-only per migration plan)
- Auto-abort Cloud Function deploy
- Cloud Scheduler for `aggregate_shadow_diffs.py`
- App Check + reCAPTCHA v3 site-key registration
- Firebase AI Logic `useHybridInference` flip when SDK ships the feature

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
