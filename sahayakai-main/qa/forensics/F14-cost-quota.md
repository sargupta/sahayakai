# F14 — Cost + Quota Forensics

**Date:** 2026-06-06
**Investigator:** Role 8 specialist (cost + quota forensics)
**Scope:** Gemini token burn, image-gen runaway risk, Sarvam-vs-Gemini STT cost attribution, Q4C canary-observation cost doubling, embedding cache growth.
**Branch:** `feature/q4c-shadow-diff-in-canary` (the very branch that introduced the 2× spend).

---

## TL;DR

**Three P0 findings, three P1, one P2.** The Q4C shadow-diff-in-canary toggle (`SHADOW_DIFF_IN_CANARY_OBSERVATION = true`) doubles Gemini spend across all 14 canary agents AND ALSO does the same on the canary "bucket-overshoot" Genkit branch — so during a canary@10% ramp, 100% of traffic on those agents pays double-cost, not just the 10% that touched the sidecar. Worse, this includes **billed image generation** ($0.04/image): visual-aid and avatar now ship **$0.08/image** during canary observation, and the second image is NOT subject to the daily 10-image quota gate, breaking the cost ceiling we promised users.

The non-Q4C surface is mostly clean — bounded retries, daily-rate cron, tab-visibility-gated persona pulse, capped persona-pool generation, no unbounded local cache.

---

## P0 — confirmed

### P0-1 — Q4C doubles cost on 100% of traffic, not 10% (mid-canary)
**File:** `src/lib/sidecar/canary-shadow-diff.ts:21` (flag) + every `src/lib/sidecar/*-dispatch.ts` (17 dispatchers wired).

The flag block-comment claims:
> Cost: ~2× Gemini calls during canary AND full. Intentional — observability during rollout.

The implementation is worse than the comment:

1. **Canary primary branch** (`decision.mode === 'canary'/'full'`, sidecar served): after the sidecar returns, the dispatcher fires `runGenkitSafe(input)` in the background and writes a shadow-diff — second Gemini call.
2. **Canary bucket-overshoot branch** (`decision.mode === 'off'` but `decision.configuredMode === 'canary'`, Genkit served): after the Genkit response, the dispatcher fires `runSidecarSafe(...)` in the background and writes a shadow-diff — second model call.

So at canary@10%, every request on the 14 wired agents pays **2× model cost** — the 10% that hits the sidecar AND the 90% that misses it. The percent gate only decides which provider serves the user; the OTHER provider is always called for observability.

**Affected agents (14):** voice-to-text, visual-aid, avatar, lesson-plan, vidya, quiz, exam-paper, worksheet, rubric, teacher-training, virtual-field-trip, instant-answer, parent-message, video-storyteller. (Also assessment-scanner, community-persona, assignment-assessor wired but not in the published canary cohort.)

**Cost math (rough, per agent per day assuming 1,000 calls/day):**

| Agent | Genkit cost/call | Pre-Q4C cost/day | Post-Q4C cost/day | Delta |
|---|---|---|---|---|
| visual-aid | $0.04 (image) | $40 | $80 | +$40 |
| avatar | $0.04 (image) | $40 | $80 | +$40 |
| instant-answer | $0.035 (grounding) + tokens | $35+ | $70+ | +$35 |
| lesson-plan | ~4× flash calls in sidecar, 1× in Genkit | small | +1 large flash call/request | +$3-5 |
| vidya (router) | flash @ ~500 tokens | <$1 | $2 | +$1 |
| 10 other text agents | flash | <$1 ea | $2 ea | +$10 |

**Projected monthly delta during canary observation (single-tenant scale, 1k/day each):** ~**$3,800/month over baseline**. At pilot scale (10k teachers, ~5 calls/teacher/day on at least one agent) the delta scales linearly into the five-figure range.

**Severity:** P0 — confirmed runaway spend on a flag that's currently `true`.

**Fix:**
- Either gate Q4C on `decision.mode !== 'off' && bucket >= percent` (only run observation on the overshoot bucket, NOT on the served path) — i.e. you ALWAYS have exactly one provider call for the user PLUS one observation call for the OTHER bucket bracket, never two for the same user.
- Or flip `SHADOW_DIFF_IN_CANARY_OBSERVATION = false` until we move beyond canary; restrict observability to true `shadow` mode (which is already wired and already doubles cost intentionally — but only at the configured shadow %).
- Hard cost ceiling: add a daily aggregate cost budget in `costService.trackDailyUsage` so Q4C cannot silently 2× the bill without an alert. Currently `UsageTracker` only logs.

### P0-2 — Image-gen Q4C bypasses the 10-images-per-day quota
**File:** `src/lib/sidecar/visual-aid-dispatch.ts:247-298`, `src/lib/server-safety.ts:19-47`.

`checkImageRateLimit(userId)` runs ONCE before the primary sidecar call (`visual-aid-dispatch.ts:247`). After the sidecar succeeds, Q4C fires `runGenkitSafe(input)` which generates a second image via `gemini-3-pro-image-preview` ($0.04). That second image is NOT counted against the daily quota — Firestore counter ticked once for two images.

Net effects:
- A teacher at "10/10 daily limit" can still trigger one more image via the Q4C path (the message just says limit reached and the route bails, but the background Genkit call for the previous request already shipped).
- Image budget displayed to operators ($0.04 × calls) is half of reality.
- A malicious caller throttled to 10/day actually consumes 20 images of compute.

**Same applies to avatar-dispatch.ts** — `runGenkitSafe` for the avatar flow ($0.04/call on `gemini-2.5-flash-image`) fires unchecked.

**Severity:** P0 — confirmed budget ceiling broken.

**Fix:** Either (a) move `checkImageRateLimit` into the model-call wrappers (`runGenkitSafe` + `runSidecarSafe`) so EVERY image call hits the quota gate, or (b) suppress Q4C observation on image-gen agents (treat them as a non-observed cohort because the cost-to-signal ratio is awful).

### P0-3 — `UsageTracker` does NOT enforce budgets, only logs
**File:** `src/lib/usage-tracker.ts`.

Every flow calls `UsageTracker.trackGemini(...)` / `trackImageGen(...)` after the model returns. The tracker does two things:
1. `logger.info(...)` — structured log line.
2. `costService.trackDailyUsage(type, value)` — aggregate Firestore counter.

There is **no enforcement layer** that reads those counters and rejects further calls. Every `gemini-2.5-pro` assignment-assessor call ($0.005-$0.04 each depending on vision payload) lands unchecked. A pathological user (or runaway loop in a flow we haven't audited) can spend uncapped until manual operator intervention.

This is structural — present long before Q4C — but Q4C makes it acute because the doubled spend is invisible to any caller-side throttle.

**Severity:** P0 — no cost ceiling exists, only an observability surface.

**Fix:** Add `enforceDailyBudget(userId, type)` that reads the same daily counter the tracker writes, with per-plan caps:
- Free: 50 Gemini-flash calls, 5 grounding, 10 images.
- Pro: 500 flash, 50 grounding, 50 images.
- Throw 429 before the model call.

---

## P1

### P1-1 — Q4C observation lacks a sampling rate (always 100% of canary traffic)
**File:** `src/lib/sidecar/canary-shadow-diff.ts`.

The flag is a binary. Shadow-diff parity scoring needs O(few hundred) samples per agent per day to be statistically meaningful, not O(thousands). Yet Q4C writes a shadow-diff on EVERY canary-mode request. A 1% sample (random gate per request) gives you the same parity signal at 1/100th the cost.

**Severity:** P1 — over-spend without proportional signal gain.

**Fix:** Add `SHADOW_DIFF_SAMPLE_RATE = 0.05` and `if (Math.random() < SHADOW_DIFF_SAMPLE_RATE)` around each `void runGenkitSafe(...)` / `void runSidecarSafe(...)` observation block.

### P1-2 — `agent_shadow_diffs/{date}/{agent}` collections grow unbounded
**File:** `src/lib/sidecar/shadow-diff-writer.ts:84-118`.

Every Q4C request writes one Firestore doc with full `genkit` + `sidecar` payloads (lesson-plan: ~5 KB, instant-answer with sources: ~10 KB). At 1k calls/day × 14 agents × Q4C-doubling = 14k docs/day × ~5 KB = 70 MB/day, ~2 GB/month, retained forever. Firestore storage = $0.18/GB/month ($0.36/month — negligible) BUT Firestore reads for the aggregator scale linearly ($0.06/100k reads). Read cost is the concern: if the promotion-gate aggregator scans the full date doc-set, that's 100s of thousands of doc reads/day.

**Severity:** P1 — quiet ballooning storage + read cost; no TTL.

**Fix:** Add a Firestore TTL policy on `agent_shadow_diffs/{date}/{agent}/*` set to 30 days. (Firestore Console → Indexes → TTL; field `createdAt`, retention 30d.)

### P1-3 — Assignment-assessor uses `gemini-2.5-pro` with no per-call cost cap
**File:** `src/ai/flows/assignment-assessor.ts:28`.

`gemini-2.5-pro` multimodal is the priciest SKU in the stack (~$1.25/1M input tokens, $5/1M output, plus image input). A teacher uploading 30 student worksheets in a class assessment session at 2-3 images each = 60-90 pro calls. No per-session ceiling. With Q4C also enabled if this lands on canary, you double it.

**Severity:** P1 — per-session cost can spike >$5 silently for a single teacher.

**Fix:** Cap `assignmentAssessor` to N images per session (configurable, default 20) AND apply the proposed `enforceDailyBudget` from P0-3.

---

## P2

### P2-1 — Persona-pulse 503 retry timer (15-min) survives feature-flag flip but eats wall clock
**File:** `src/hooks/use-community-live-pulse.ts:117-132`.

When the server returns 503 (feature disabled), the hook schedules a 15-min retry. If an operator disables the feature for cost reasons and then closes the tab, the retry is forgotten — but if the tab stays open through several disables, the operator-intended "stop" is rescheduled silently. The hook IS visibility-gated and IS bounded, so this is P2, not P1.

**Severity:** P2 — minor; cost impact <$0.10/teacher/day even at worst.

**Fix:** On 503 with a particular `reason` field (`feature_flag_killswitch`), stop polling for the session (not a 15-min retry).

---

## Beats that came back clean

| Beat | Status | Evidence |
|---|---|---|
| `qa/embedding-cache/` unbounded growth | **Not applicable** | Directory does not exist. Embeddings stored in Firestore vector field (`pyq_retrieval_service.ts`), not local disk. |
| Retry storms in image-gen | **Clean** | Neither `visual-aid-designer.ts` nor `avatar-generator.ts` has a retry loop. Single-attempt fail-up. |
| Sarvam retry storm | **Clean** | `src/lib/sarvam.ts` caps at `MAX_RETRIES = 2` with 1s/2s backoff; only retries on 5xx and network failures. |
| `grow-persona-pool` runaway | **Clean** | Capped at `MAX_PER_RUN = 15` per invocation; cron-secret gated; no auto-loop. |
| `daily-briefing` runaway | **Clean** | Single daily cron (`30 2 * * *`); fixed N-call structure (Hindi + per-state curate). |
| Voice-to-text Gemini script-mismatch retry | **Clean** | Bounded to ONE retry with `forceScript: true`. |
| Sarvam STT cost vs Gemini STT | **Cost favourable** | Sarvam tier 1, Gemini multimodal tier 2/3. Sarvam routes Indian languages cheaper; Gemini fallback only on Sarvam error. |

---

## Repros

See `qa/forensics/F14-repros/`:
- `F14-repros/q4c-canary-doubles-cost.md` — call-graph trace showing 2× model calls per request.
- `F14-repros/visual-aid-quota-bypass.md` — sequence diagram showing 11th image landing despite "10/day" cap.

---

## Recommended action sequence (priority order)

1. **Now (P0-1):** flip `SHADOW_DIFF_IN_CANARY_OBSERVATION = false` until either (a) sampling lands, or (b) cost budget shows headroom to cover the 2× burn. The promotion gate currently lacks denominator data; alternative is to land Phase M.5 `shadow` mode at 5% per agent — same signal, fraction of cost.
2. **Today (P0-2):** move `checkImageRateLimit` into the model-call wrappers; suppress Q4C observation for visual-aid + avatar.
3. **This week (P0-3):** implement `enforceDailyBudget(userId, type)` reading the existing `costService` counters; ship with conservative free-tier caps.
4. **Next sprint (P1-1, P1-2, P1-3):** sampling rate constant, Firestore TTL on shadow-diffs, assignment-assessor per-session cap.

---

## Out of scope (could not verify without prod access)

- Cloud Billing export query (no `gcloud` BigQuery export configured in repo).
- Live SKU breakdown $/day for last 7 days.
- Actual call volumes from `agent_shadow_diffs` doc counts (need read access).

These should be queried by the on-call operator with `bq query --use_legacy_sql=false 'SELECT service.description, SUM(cost) FROM \`sahayakai-b4248.billing_export.gcp_billing_export_v1_*\` WHERE _PARTITIONTIME >= TIMESTAMP_SUB(CURRENT_TIMESTAMP, INTERVAL 7 DAY) GROUP BY 1 ORDER BY 2 DESC'` and cross-referenced against this report.
