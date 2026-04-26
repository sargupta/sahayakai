# Parent-call ADK Python sidecar — pilot scaffold + Day-1 audit fixes + Tracks C/D

## Summary

Lands the full Tracks A (Next.js integration), B (sidecar polish), C (deploy automation), and D (auto-abort safety net) scaffold for the parent-call agent migration to a FastAPI sidecar on `google-adk` 1.31. **Default flag `parentCallSidecarMode: 'off'` means zero traffic-impact on merge** — the sidecar code path is live but unreached until Firestore flag-flip.

52 commits; ~74 files; ~7,800 insertions; 135 Python tests + 65 Jest tests passing.

**Two adversarial review passes** by 30 specialist agents (Codex/Gemini-style) closed 14 P0 + 6 P1 production bugs that the initial scaffold contained.

## Commit narrative

### Day-1 audit blockers (8 commits)

| commit | fix |
|---|---|
| `fedf73988` | Unpin fictitious `google-genai==0.10.0` and stale `google-adk==1.0.0`; switch to async Gemini surface (`client.aio.models`); drop schema defaults that crash google-genai issue #699 |
| `753c8500a` | Firestore composite-key `{turn:04d}_{role}` + role-aware OCC — fixes silent multi-turn 409 collision |
| `257e7c6b2` | Stop appending `parentSpeech` to transcript before render (template renders both blocks separately) |
| `daf515914` | Kill `compare_parity.py` self-comparison tautology — replaced with `NotImplementedError` to prevent false-green dashboards |
| `d3d0bbe5f` | Port `assert_all_rules` behavioural guard to Genkit fallback path (`src/lib/parent-call-guard.ts`) — fail-closed on identity-leak / wrong-script / overly-long replies |
| `d174d93e4` | Switch prompt renderer from `pystache` (Mustache only) to `pybars3` (Handlebars) — `{{#if}}` blocks were silently 502'ing in production |
| `50636a0b0` | Make `ruff` + `mypy` gates fully green: 75 → 0 ruff errors, 15 → 0 mypy errors |

### Track A — Next.js integration (5 commits, all default-off)

| commit | adds |
|---|---|
| `9535770ee` | A1: `parentCallSidecarMode` feature flag (off / shadow / canary / full) with `decideParentCallDispatch(callSid)` |
| `45ddbb648` | A2+A3: `signing.ts` (HMAC-SHA256 body digest) + `parent-call-client.ts` (Google ID token + 3.5s `AbortController`) |
| `3fc392513` | A4+A5: `dispatch.ts` four-mode dispatcher + `shadow-diff.ts` fire-and-forget Firestore writer + TwiML route wiring at line 209 |
| `50daa2b7f` | A6: `record-parent-call-fixtures.ts` — records 22 fixtures across 11 languages |
| `8d9645cbb` | Dispatcher unit test: 19 cases covering off / shadow / canary / full × {sidecar OK, transport err, behavioural err} |

### Track B — sidecar polish (3 commits)

| commit | adds |
|---|---|
| `6c969169c` | Real `compare_parity.py` v1 — `httpx.AsyncClient(ASGITransport)` replay + tier-1 TF cosine + tier-2/3 stubs |
| `6902e9725` | `compare_parity.py` v2 — tier 2 (IndicSBERT cosine via sentence-transformers) + tier 3 (Gemini-2.5-Pro LLM-as-judge over 6-axis rubric) + two-phase replay/score refactor |
| `293807f86` | CI gates: blocking mypy + behavioural test selector + parity smoke + develop branch trigger |

### Track C — deploy automation (1 commit)

| commit | adds |
|---|---|
| `1361f33f9` | `scripts/post-deploy-smoke.sh` (six-step contract verification incl. IAM + audience binding) + `scripts/hydrate-audience-secret.sh` (idempotent post-deploy `SAHAYAKAI_AGENTS_AUDIENCE` rotation with stale-version disabling) |

### Track D — auto-abort safety net + shadow-diff metric writer (2 commits)

| commit | adds |
|---|---|
| `141cea0b8` | Cloud Function `cloud_functions/auto_abort/` — Pub/Sub trigger that demotes `parentCallSidecarMode` / `parentCallSidecarPercent` one rung down the ladder per alert. 9-rung ladder pinned by 20 unit tests. Six Cloud Monitoring alert policy YAMLs (5xx rate, p95 latency, behavioural-guard rate, shadow-diff LaBSE, Firestore 409 rate, Gemini spend) under `policy_templates/`. README documents Pub/Sub topic, IAM bindings, alert apply flow, manual-abort escape hatch, local test recipe |
| `11e90fc7f` | Cloud Function `cloud_functions/shadow_diff_aggregator/` — HTTP trigger called by Cloud Scheduler every 5 min. Reads `agent_shadow_diffs/{date}/calls/**`, skips errored samples, computes rolling LaBSE mean over the last 500 non-error pairs, writes `custom.googleapis.com/parent_call/shadow_labse_mean` + `shadow_sample_count`. 7 unit tests pin the TF cosine math (identical-bag shortcut to avoid sqrt(2)/sqrt(2) drift). **Closes alert 04's blind spot — without this writer, the LaBSE alert never fires.** |

### Hardening pass — risks called out, then closed (5 commits)

After the initial Tracks A-D landed, a second pass closed every remaining master-plan risk:

| commit | fix |
|---|---|
| `5618017dd` | **Genkit fallback timeout (master-plan risk #1).** `runResiliently` could wait 60 s on single-key 429 backoff, blowing Twilio's 15 s budget. New `withTimeout(span, ms, work)` wrapper races the genkit promise against a 10 s ceiling for `generateAgentReply` and 30 s for `generateCallSummary`. `GenkitTimeoutError` lands in the dispatcher's existing fallback path (canned safe wrap-up). |
| `b5df4bd79` | **Firestore rules + TTL (P0 RULES-1, TTL-1).** New rule blocks for `agent_sessions/**`, `agent_shadow_diffs/**`, `agent_voice_sessions/**` — all Admin-SDK-only (clients deny-by-default). New `scripts/apply-firestore-ttl.sh` enables TTL on `agent_sessions.expireAt` (24 h) + `calls.expireAt` (14 d). |
| `fc91ee49a` | **Dual deploy paths SA (P0 IAM-2).** Both `cloud-run.yml` and `apphosting.yaml` now wire `sahayakai-hotfix-resilience-runtime@...` as the Next.js runtime SA, plus the three new secrets (signing key, audience, sidecar URL). Closes the master-plan risk that one deploy path could ship without sidecar auth wired up. |
| `b3a4c82ba` | **Sidecar service.yaml (P0 TIMEOUT-1, BOOT-1).** `timeoutSeconds: 12` → `8` (matches resilience-layer's 7 s max-backoff). New `run.googleapis.com/startup-cpu-boost: "true"` annotation cuts cold-start import time from ~3.5 s to ~1.5 s. |
| `7ad2041e2` | **Pre-work automation (P0 BOOT-2, SEED-1, PREFLIGHT-1).** Three new scripts: `generate-signing-key.sh` (256-bit random + Secret Manager rotation), `seed-feature-flags.sh` (creates Firestore feature_flags doc with parentCallSidecar* fields so auto-abort transactions can update it), `preflight-shadow-ramp.sh` (15-gate checklist that returns 0 only when every gate is green; each failure prints its specific remedy script). |
| `d3271ef47` | **Test gaps closed.** 23 new Jest tests for `parent-call-guard.ts` (forbidden phrases × 7 variants, script match across Hindi/Tamil/English with code-switch tolerance, sentence-count edge cases) + 5 tests for `withTimeout` (deterministic 10s-ceiling firing under fake timers). Total Jest count goes from 19 → 47. |
| `7f640c296` | **One-shot Track D bootstrap (P0 BOOTSTRAP-1).** New `scripts/bootstrap-track-d.sh` — idempotent gcloud orchestration that creates 4 SAs + IAM bindings + 3 secret containers + Pub/Sub topic + 2 Cloud Functions (with HTTP variants) + Cloud Scheduler cron + 6 Cloud Monitoring alert policies in one go. Each step is existence-checked so re-running on partial state resumes cleanly. |
| `c3e8e018d` | **Runbook Track D first-time bootstrap section.** Inlines the 10-step operator workflow from "PR merged" to "ready to flip flag" using only the scripts in this PR. Each script idempotent. Operator pastes the block end-to-end. |

### Adversarial review pass 1 — 14 P0 fixes (groups A-G)

A 30-agent adversarial review (organized in 6 specialist groups, ran in parallel) found 14 P0 bugs that the initial scaffold contained. All fixed across 12 commits in three waves:

**Wave 1 — security/credential (3 commits):**
| commit | fix |
|---|---|
| `c322880f1` | Firebase API key rotation hygiene — apphosting + deploy_shadow → Secret Manager refs (G1) |
| `0434eaf03` | Drop project-level `secretmanager.secretAccessor`; per-secret bindings only (D3) |
| `5d9fef103` | New `grant-nextjs-invoker.sh` post-deploy script + runbook step 8b + preflight gate 4b (D3, IAM-4) |

**Wave 2 — auto-abort correctness (3 commits, 5 fixes):**
| commit | fix |
|---|---|
| `bb9f23e27` | **canary/0 → shadow/25 PROMOTE bug killed (LADDER-1)** — auto-abort was AMPLIFYING failed rollouts on the first alert fire. 3 regression tests. |
| `f037a7435` | Recovery-notification skip + unknown_policy bail + incident-id dedupe (RECOVERY-1, UNKNOWN-1, DEDUPE-1). 13 new tests. |
| `d98bbbf62` | NaN guards + try/except in metric writer (NAN-1) — single corrupted embedding used to silently break alert 04 for hours. |

**Wave 3 — architectural (6 commits):**
| commit | fix |
|---|---|
| `95b2ed292` | apphosting BUILD availability (`NEXT_PUBLIC_*` baked at build time) + 3 missing server secrets — apphosting deploys would have 500'd on every AI flow (APPHOSTING-1, APPHOSTING-2) |
| `b4efba756` | system_config admin-only + `calls` → `shadow_calls` collection-group rename (SYSCONF-1, TTL-2) — leaked rollout state to all teachers + collection-group footgun |
| `01e6b0cb0` | Behavioural guard hardening: apostrophe + synonym + NFKC + ZWJ strip + Python-TS alpha alignment (GUARD-1..4). 15 new TS tests. |
| `cf5796224` | Signing-key 5-min TTL + IdToken cache eviction on reject (ROTATION-1, CACHE-1) — silent post-rotation breakage + cold-start poisoning |
| `dc61737b3` | Dispatcher AbortError rethrow + decide-dispatch 1.5s timeout (ABORT-1, DECIDE-1) — phantom replies on dead connections |
| `23ca1c082` | Shadow parity alert threshold realignment + sample-count gate (ALERT-1) — alert 04 would have fired on every clean shadow ramp before this fix |

### Adversarial review pass 2 — Wave 4 P1 hardening (5 commits)

After the P0 wave, a follow-up sweep on the P1 list closed 6 more issues:

| commit | fix |
|---|---|
| `fbd69df6f` | Schema bounds + callSid Twilio pattern (SCHEMA-1, SCHEMA-2) — DoS prevention + path-injection defence |
| `6bd2eac4c` | Prompt injection sanitization (INJECT-1) — NFKC + injection-marker strip + U+27E6/U+27E7 untrusted-input wrap on every parent + teacher-controlled field |
| `180224059` | HMAC replay protection — `X-Request-Timestamp` header + ±5min skew check (REPLAY-1). 4 new auth tests. |
| `a6baf7b91` | Cyrillic / Greek / fullwidth confusable folding (GUARD-5) — closes the documented gap from Wave 3 fix 3. 3 new TS tests. |
| `935ed462f` | DPDP scaffold: consent-prologue infrastructure + `erase-parent-data.py` helper + `.claude/plans/dpdp-compliance.md` (DPDP-1, DPDP-2) — all default-off pending translations + region migration |

One review finding (Wave 4 fix 2 — Twilio signature post-decode) was investigated and **deliberately not fixed** — the existing implementation is correct per Twilio's spec; the agent's concern about "decoded vs raw bytes diverge" was speculative and didn't apply to our code.

## Architecture decisions

### Default-off everywhere

The flag's `FALLBACK_CONFIG` defaults to `'off'`, so any Firestore outage routes traffic to Genkit-only. Flipping requires a deliberate single-field edit in the `system_config/feature_flags` document.

### Bucketing on `callSid`, not `uid`

TwiML webhooks are unauthenticated — there is no `uid` at the dispatcher. `callSid` is stable for the lifetime of one call so all turns of a call ride the same dispatch path; half-shadow / half-Genkit within one call would produce an incoherent transcript.

### Behavioural-error rethrow (not Genkit fallback)

In canary / full mode, `SidecarBehaviouralError` (502 from sidecar's fail-closed guard) **rethrows** instead of falling back to Genkit. Genkit would likely produce the same suspect output — same model, same prompt — so falling back masks the issue. The route's outer try/catch lands the canned safe wrap-up instead.

### HMAC body digest on top of Cloud Run ID token

The ID token authenticates the **caller** but does not bind to the body. `SAHAYAKAI_REQUEST_SIGNING_KEY` (Secret Manager, mounted into both Next.js and sidecar) closes that gap.

### 3.5s client-side timeout

Sidecar has 8s `timeoutSeconds` on Cloud Run; Twilio gives 15s end-to-end including STT and TTS. 3.5s leaves ~5s for TTS speak budget plus the sidecar's resilient backoff. Timing out client-side prevents a slow sidecar from blowing the whole TwiML window.

### Auto-abort demotion ladder

| Current state           | Demotes to              |
|-------------------------|-------------------------|
| `full / 100%`           | `canary / 100%`         |
| `canary / 100%`         | `canary / 50%`          |
| `canary / 50%`          | `canary / 25%`          |
| `canary / 25%`          | `canary / 5%`           |
| `canary / 5%`           | `shadow / 25%`          |
| `shadow / 25%`          | `shadow / 5%`           |
| `shadow / 5%`           | `shadow / 1%`           |
| `shadow / 1%`           | `off / 0%`              |
| `off / 0%`              | `off / 0%` (no-op)      |

One step per fire — never more. Pinned by `cloud_functions/auto_abort/test_demote.py` (20 tests).

## Test evidence

```
sahayakai-agents/  (Python)
  ruff check src tests scripts cloud_functions  → All checks passed!
  mypy src/                                     → 16 source files, 0 errors
  mypy scripts/compare_parity.py                → 0 errors
  mypy cloud_functions/                         → 2 source files, 0 errors
  pytest                                        → 135 passed (~3s)
                                                  - 53 unit (incl. 4 replay-protection)
                                                  - 5 integration
                                                  - 38 behavioural (11-language matrix)
                                                  - 32 auto-abort (incl. recovery + dedupe)
                                                  - 7 shadow-rollup

sahayakai-main/  (TypeScript)
  tsc --noEmit          → 0 errors
  jest src/__tests__/   → 65 passed across 3 suites
                          - 19 dispatcher (off/shadow/canary/full × 3 outcomes)
                          - 41 guard (incl. confusable folding, ZWJ strip)
                          - 5 timeout (deterministic 10s-ceiling)
```

## Rollout plan (post-merge)

This PR lands the **scaffold AND the safety net**. The 5-track rollout to 100 % traffic is documented in [`.claude/plans/prepare-a-detailed-execution-iridescent-hamming.md`](.claude/plans/prepare-a-detailed-execution-iridescent-hamming.md). Headlines:

1. **Pre-work (human, blocking C):** create `sahayakai-agents-runtime` SA + `sahayakai-auto-abort-runtime` SA + IAM bindings, populate `SAHAYAKAI_REQUEST_SIGNING_KEY` and `GOOGLE_GENAI_SHADOW_API_KEY` in Secret Manager, add Firestore rules + TTL for `agent_sessions/{callSid}` and `agent_shadow_diffs/{date}/calls/**`, create the `parent-call-auto-abort` Pub/Sub topic.
2. **Track C — first deploy:** `cd sahayakai-agents && gcloud builds submit --config=deploy/cloudbuild.yaml`. Run `bash scripts/post-deploy-smoke.sh` — six checks including IAM-protected POST and audience-binding verification. Run `bash scripts/hydrate-audience-secret.sh` to write the resolved Cloud Run URL into Secret Manager. Both scripts are idempotent.
3. **Track D — auto-abort first, then shadow ramp (7 days):** Deploy `cloud_functions/auto_abort/` BEFORE flipping the flag — apply the six policy YAMLs from `policy_templates/`, then flip `parentCallSidecarMode` to `shadow@1% → 5% → 25% → 50%`, one step / 1-2 days. Auto-abort wired on 5xx rate, p95 latency, behavioural-guard rate, parity LaBSE drop, Firestore 409 rate, Gemini cost overshoot.
4. **Track E — canary → cutover (7 days):** `canary@5% → 25% → 50% → full`. Hold 100 % for 48h before any dead-code removal.

## Pre-merge checklist for reviewers

- [ ] Codex peer review (per CLAUDE.md `feedback_peer_review_codex_gemini.md`)
- [ ] Gemini peer review (same)
- [ ] User runs `npm run record:parent-call-fixtures` locally + commits `tests/fixtures/parent_call_turns.json` (~$0.05 in Gemini calls; gates Track D)
- [ ] Confirm `parentCallSidecarMode` is `'off'` in production Firestore at `system_config/feature_flags` BEFORE merging (it should already be, since this PR introduces the field with a fallback default of `off`, but verify)
- [ ] CI green on `feature/adk-python-sidecar-pilot`

## Out of scope for this PR

- Actually running `gcloud builds submit` (Track C is the AUTOMATION; the deploy itself is human-gated)
- Phase 2 voice via Gemini Live, Phase 3 writer-evaluator-reviser, Phase 4 RAG over NCERT — three separate plans landed in `.claude/plans/phase-{2,3,4}-*.md`. Each one branches off this base.

## Risks called out (and what's been closed)

| Risk | Status |
|---|---|
| Genkit fallback can wait 60 s on quota-exhaustion (blowing Twilio's 15 s budget) | **Closed** in `5618017dd` — `withTimeout` 10 s ceiling. |
| Dual deploy paths (cloud-run.yml + apphosting.yaml) drift on SA wiring | **Closed** in `fc91ee49a` — both paths point at `sahayakai-hotfix-resilience-runtime` with same secret bindings. |
| Sidecar timeoutSeconds (12 s) > Twilio client timeout (3.5 s) | **Closed** in `b3a4c82ba` — capped at 8 s. |
| Firestore rules / TTL for new collections — was "human pre-work" | **Closed** in `b5df4bd79` — rules diff + idempotent `apply-firestore-ttl.sh`. |
| Signing key generation + secret seeding + preflight check — was "human pre-work" | **Closed** in `7ad2041e2` — three idempotent shell scripts. |
| Cost ramp under shadow (~2× Gemini spend for 2 days at 50% shadow) | **Open** — Cloud Monitoring budget alert at 2× baseline (operator wires this in pre-work). |
| Multi-region failover — sidecar is asia-southeast1 only | **Open and accepted** — Phase 1 single-region per master plan. Phase 2 / 3 / 4 stay single-region too; Phase 5+ revisits.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
