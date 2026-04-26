# Parent-call ADK Python sidecar — pilot scaffold + Day-1 audit fixes + Tracks C/D

## Summary

Lands the full Tracks A (Next.js integration), B (sidecar polish), C (deploy automation), and D (auto-abort safety net) scaffold for the parent-call agent migration to a FastAPI sidecar on `google-adk` 1.31. **Default flag `parentCallSidecarMode: 'off'` means zero traffic-impact on merge** — the sidecar code path is live but unreached until Firestore flag-flip.

21 commits; 50+ files; ~3,800 insertions; 112 Python tests + 19 Jest tests passing.

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

### Track D — auto-abort safety net (1 commit)

| commit | adds |
|---|---|
| `141cea0b8` | Cloud Function `cloud_functions/auto_abort/` — Pub/Sub trigger that demotes `parentCallSidecarMode` / `parentCallSidecarPercent` one rung down the ladder per alert. 9-rung ladder pinned by 20 unit tests. Six Cloud Monitoring alert policy YAMLs (5xx rate, p95 latency, behavioural-guard rate, shadow-diff LaBSE, Firestore 409 rate, Gemini spend) under `policy_templates/`. README documents Pub/Sub topic, IAM bindings, alert apply flow, manual-abort escape hatch, local test recipe |

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
  mypy cloud_functions/auto_abort/main.py       → 0 errors
  pytest                                        → 112 passed (~3s)
                                                  - 49 unit
                                                  - 5 integration
                                                  - 38 behavioural (11-language matrix)
                                                  - 20 auto-abort demote (this PR)

sahayakai-main/  (TypeScript)
  tsc --noEmit          → 0 errors
  jest src/__tests__/lib/sidecar-dispatch.test.ts
                        → 19 passed (0.23s)
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
- Shadow-diff aggregation Cloud Function — the rolling LaBSE-mean metric the auto-abort key 4 keys off is written by a separate Cloud Function still TBD
- Phase 2 voice via Gemini Live (separate plan, separate branch)

## Risks called out

- **Genkit fallback under quota exhaustion** — `runResiliently` in Genkit can wait up to 60s on single-key 429s. Sidecar transport-error fallback to Genkit could blow the 15s Twilio budget if the live key pool is throttled. Mitigation deferred — owner of `runResiliently` should add an `AbortController` ceiling.
- **Dual deploy paths** (`cloud-run.yml` + `apphosting.yaml`) — both need the new Next.js runtime SA. Track C's pre-work step must update both; consolidate to one in a follow-up plan.
- **Cost ramp under shadow** — at 50 % shadow, Gemini spend roughly doubles for parent-call traffic for ~2 days. Cloud Monitoring budget alert at 2× baseline.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
