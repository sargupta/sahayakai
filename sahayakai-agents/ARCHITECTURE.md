# Architecture — sahayakai-agents

Short, load-bearing document. Every design decision here is traceable to a review
finding from Round 1 (2026-04-24) or to the parent plan at
`sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`.

**ADK design-pattern source of truth: https://adk.dev/** — when an agent
module, tool, or orchestration pattern is ambiguous, defer to the adk.dev
reference before inventing a local convention. User directive, 2026-04-24.

## 1. Why this service exists

Stateful and voice AI agents move server-side so:

- Multi-turn session state survives cold starts, page reloads, and call-drops.
- Prompt caching observability is unified across all AI paths.
- Phase 2 Gemini Live bidirectional voice can land without reshaping the runtime.

The Next.js app keeps every stateless single-shot flow (lesson plan, quiz, worksheet,
exam paper, rubric, visual aid, virtual field trip, video storyteller, parent message,
avatar, voice-to-text). Nothing there changes because of this sidecar.

## 2. Request shape

Twilio phones the parent. Twilio webhooks into Next.js at
`src/app/api/attendance/twiml/route.ts`. Next.js wraps the real model call in an
in-request circuit breaker. On the happy path, it posts to this sidecar. On sidecar
timeout > 4 seconds or HTTP 5xx, Next.js falls back — inside the same Twilio
webhook lifetime — to the current Genkit implementation of the parent-call agent.
Feature-flag-off and circuit-breaker-trip are two independent kill switches.

```
Parent phone
    │
    ▼
Twilio  ── webhook (15s budget) ──► Next.js /api/attendance/twiml
                                      │
                          circuit breaker:
                          timeout > 4s OR 5xx → fall back to Genkit
                                      │
                                      ▼ (happy path)
                        POST sidecar /v1/parent-call/reply
                        Authorization: Bearer <IAM-ID-token>
                        X-Content-Digest: <HMAC(body, rotating-key)>
                                      │
                                      ▼
                        sidecar → ADK LlmAgent → Gemini
                                      │
                        Firestore txn: append turn to agent_sessions/{callSid}
                                      │
                                      ▼
                        response ≤ 3 seconds end-to-end (p95 target)
```

## 3. Review-Informed Decisions

All ten P0 blockers and P1 issues from Review Round 1 are addressed structurally.
Each bullet below names the finding and the decision.

### P0 fixes

- **P0 #1 cold-start drops parent calls.** `min-instances=1` mandatory in staging
  and production from first deploy. `deploy/service.yaml` enforces this. The Cloud Run
  `autoscaling.knative.dev/minScale` annotation is a deploy-time hard requirement.
- **P0 #2 shadow shares Gemini quota.** Shadow mode on the Next.js side uses
  `GOOGLE_GENAI_SHADOW_API_KEY` — a completely separate key pool from the live
  `GOOGLE_GENAI_API_KEY`. A 429 on shadow cannot degrade a live call.
- **P0 #3 no per-request fallback.** The circuit breaker is a Next.js-side concern
  (TypeScript), enforced by a wrapper around the sidecar `fetch`. The sidecar's job
  is to return 5xx fast (never time out silently). Sidecar exposes a typed 503
  `AI_QUOTA_EXHAUSTED` with `Retry-After` so Next.js can make the fall-back decision.
- **P0 #4 prompt drift.** `prompts/parent-call/*.handlebars` is the single source.
  Next.js renders via `Handlebars.compile`. Python renders via `pystache`. CI step
  hashes the rendered strings with a set of canned variables and fails on byte
  mismatch between sides.
- **P0 #5 identity rule untested.** `tests/behavioral/test_identity_rules.py` runs
  a forbidden-phrase scan across every parity fixture output: the words `Sahayak`,
  `SahayakAI`, `AI`, `bot`, `assistant`, `I am an AI`, and locale equivalents must
  NOT appear in `reply`.
- **P0 #6 language coverage thin.** Parity fixtures minimum is 22 (2 × 11 supported
  languages). `tests/fixtures/parent_call_turns.json` carries a language coverage
  matrix. Each fixture asserts script-correctness (Hindi in Devanagari, Tamil in
  Tamil script, etc.) via Unicode range checks.
- **P0 #7 cosine wrong metric.** Cosine on English embeddings is replaced by
  (a) LaBSE multilingual similarity ≥ 0.88 and (b) Gemini LLM-as-judge returning
  `{semantic_match, tone_match, language_match}` triple. Both must pass.
- **P0 #8 turn-5/6 untested.** Dedicated behavioral tests assert: at turn 5 the
  reply tone must include a wrap-up phrase from the Bharat-first closing set; at
  turn 6 `shouldEndCall` must be `True` regardless of model output.
- **P0 #9 review sequencing.** Architecture review happens PRE-code (now; that's
  Review Round 1). Post-code implementation review happens after the final
  commits on this branch, before any deploy.
- **P0 #10 session key collision.** Firestore writes use transactions with a
  `(callSid, turnNumber)` composite document key. An out-of-order or duplicate
  turn number is rejected with HTTP 409.

### P1 fixes

- **P1 #11 backoff tuned for telephony.** `resilience.py` caps total retry wait at
  `MAX_TOTAL_BACKOFF_SECONDS = 7`. Twilio webhook budget is 15s; we leave headroom.
  The Next.js `runResiliently` profile stays as-is (it serves non-telephony).
- **P1 #12 IAM invoker identity.** `auth.py` verifies Google-issued ID tokens via
  `google.auth.transport.requests.Request` + `google.oauth2.id_token.verify_oauth2_token`.
  No shared secret in production. Local dev uses the same path with a dev SA.
- **P1 #13 A2A / MCP hedge.** `main.py` serves `/.well-known/agent.json` describing
  the agent card per A2A spec. `/v1/parent-call/reply` is an alias for the A2A
  `tasks/send` primitive — the handler reads the same Pydantic model either way.
- **P1 #14 schema source of truth.** Pydantic models in `agents/parent_call/schemas.py`
  are canonical. TypeScript types are generated from them via
  `datamodel-codegen --input-file-type=jsonschema` in a CI step. Next.js consumes
  the generated types.
- **P1 #15 body-integrity HMAC.** Every request carries `X-Content-Digest:
  sha256=<base64>` computed by Next.js with a per-environment key from Secret
  Manager. Sidecar recomputes and rejects on mismatch.
- **P1 #16 `google-genai` pinned.** `pyproject.toml` pins `google-genai` to a
  known-good version (not transitive from ADK). Safety filter changes cannot
  surprise us between deploys.
- **P1 #17 sentence count.** Behavioral test asserts 2 ≤ `reply.split_sentences() ≤ 5`
  (room for punctuation variability). Enforced per language.
- **P1 #18 summary language.** Behavioral test asserts summary output is
  English regardless of `parentLanguage`. Uses `langdetect` with explicit
  script-based tiebreakers for CJK edge cases.
- **P1 #19 `performanceSummary` conditional-quote rule.** Behavioral test: reply
  must not contain any substring from `performanceSummary` unless the parent's
  turn text matches a marks/score keyword regex (multilingual).
- **P1 #20 cold-start baseline.** First deploy measures p99 cold start with
  `min-instances=0` to establish the why-we-set-min=1 record, then flips to
  min=1 before any traffic routes.

### P2 items addressed

- **P2 #21 timeline rescoped** in the parent plan's Phase 1 section (see
  `ai-agent-quality-and-migration-plan.md`).
- **P2 #22 missing gates** now live in `sahayakai-agents/deploy/` and
  `sahayakai-agents/.github/` (CI file).
- **P2 #23 shadow duration reconciled** at **7 days metric-driven** (95% LaBSE
  pass rate stable for 7 consecutive days), not 14 calendar days.
- **P2 #24 cache observability** ported into `resilience.py` from the Phase 0
  design (`extract_cache_metrics`).
- **P2 #25 terms defined** in §Glossary at end of this doc.
- **P2 #26 financial kill switch** is a Cloud Monitoring alert → Cloud Function
  that flips the Firestore feature flag when daily AI spend exceeds 2× baseline
  for two consecutive hours.
- **P2 #27 fixture recording is pre-G1** (now a dependency before the Python
  scaffold accepts real traffic).
- **P2 #28 Firestore throughput for Phase 2 Gemini Live** explicitly risk-accepted
  here and flagged as a Phase 2 decision.

## 4. Glossary

- **Incident:** any one of: (a) language-mismatch reply reaching a parent; (b)
  call drop attributable to sidecar code; (c) sidecar p95 latency > Genkit
  baseline × 1.25 sustained 5 minutes; (d) sidecar 5xx rate > 1% over 10 minutes.
- **In-flight call drain:** on a feature-flag flip at time *t*, any call that has
  already committed to a given path at *t* completes on that path. Only calls
  starting after *t* use the new path.
- **Shadow diff:** per-turn row in BigQuery `agent_shadow_diffs.parent_call_reply`
  comparing Genkit output vs. sidecar output for the same input.
- **LaBSE match:** cosine similarity of LaBSE-encoded `reply` strings ≥ 0.88.
- **LLM-as-judge pass:** Gemini 2.5 returns `{semantic_match: true, tone_match:
  true, language_match: true}` when given both replies and the parent language.
- **Canary:** 5% of live traffic routed to the sidecar reply path (not shadow).
- **Cutover:** flag in state `full`; 100% of traffic on sidecar reply path.

## 5. What this document is not

- Not a substitute for reading the actual code.
- Not the parent migration plan (that's in `sahayakai-main/.claude/plans/`).
- Not a runbook. Runbook lives in `deploy/RUNBOOK.md` when we write it (post-scaffold).
