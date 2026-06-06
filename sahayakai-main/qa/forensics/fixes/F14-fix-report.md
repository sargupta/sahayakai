# F14 Fix Report — Q4C Cost Doubling, Image Quota Bypass, Usage Enforcement, Shadow-Diff TTL

**Date:** 2026-06-06
**Branch:** `fix/f14-cost-quota-p0` (off `develop`)
**Worktree:** `/private/tmp/sahayakai-f14-fix`
**Reference forensic report:** `qa/forensics/F14-cost-quota.md`

## TL;DR

Three P0 cost bugs + one P1 storage bug fixed and shipped. The Q4C
shadow-diff-in-canary kill switch is FLIPPED OFF immediately
(`SHADOW_DIFF_IN_CANARY_OBSERVATION = false`) — every hour at canary@10
was burning ~$3,800/month of redundant Gemini calls. Even when
re-enabled, every observation call is now gated by a 5% sample rate so
re-flipping the flag cannot double spend on 100% of traffic again.

Image-gen Q4C now peeks the daily image cap before firing the second
$0.04 image-gen call, capping cost ceiling at the user's quota.
`UsageTracker` gains a real `checkUsage()` enforcement layer that throws
`PlanLimitExceededError`; assignment-assessor, visual-aid, and avatar
routes are wired today, the rest of the AI routes are flagged for the
next sprint (see follow-up). Firestore TTL configured on
`agent_shadow_diffs/*` subcollections so parity samples auto-delete at
90 days.

## Changes

### Fix 1 — F14-001 Q4C cost doubling

- **`src/lib/sidecar/canary-shadow-diff.ts`** — `SHADOW_DIFF_IN_CANARY_OBSERVATION`
  flipped to `false`. New `SHADOW_DIFF_CANARY_SAMPLE_RATE = 0.05`
  constant. New `shouldRunCanaryShadowDiff()` helper that combines the
  kill switch and the sample rate. Pure / sync; safe in hot paths.
- All 17 dispatchers rewritten to call `shouldRunCanaryShadowDiff()`
  instead of reading the raw constant:
  `assessment-scanner-dispatch.ts`, `assignment-assessor-dispatch.ts`,
  `avatar-generator-dispatch.ts`, `community-persona-message-dispatch.ts`,
  `exam-paper-dispatch.ts`, `instant-answer-dispatch.ts`,
  `lesson-plan-dispatch.ts`, `parent-message-dispatch.ts`,
  `quiz-dispatch.ts`, `rubric-dispatch.ts`,
  `teacher-training-dispatch.ts`, `vidya-dispatch.ts`,
  `video-storyteller-dispatch.ts`, `virtual-field-trip-dispatch.ts`,
  `visual-aid-dispatch.ts`, `voice-to-text-dispatch.ts`,
  `worksheet-dispatch.ts`.
- **Test:** `src/__tests__/lib/canary-shadow-diff-sample-rate.test.ts`
  — asserts kill switch is off, sample rate is 5% or less, gate
  respects `Math.random()` math.

### Fix 2 — F14-002 image-gen Q4C quota bypass

- **`src/lib/server-safety.ts`** — new exported `peekImageRateLimit(userId)`
  (non-throwing, non-incrementing read) + `IMAGE_RATE_LIMIT_MAX_PER_DAY`
  constant. Fails OPEN on infrastructure errors so a peek failure can
  never break the served user path.
- **`src/lib/sidecar/visual-aid-dispatch.ts`** — Q4C blocks in the
  canary/full sidecar-served branch AND the bucket-overshoot
  Genkit-served branch now `await peekImageRateLimit(userId)` and SKIP
  the second image-gen when the user is at cap. Skip is logged as
  `visual_aid.dispatch.q4c_skipped_quota`.
- **`src/lib/sidecar/avatar-generator-dispatch.ts`** — same treatment
  on both canary/full and bucket-overshoot Q4C blocks. Skip logged as
  `avatar.dispatch.q4c_skipped_quota`.
- **Test:** `src/__tests__/lib/peek-image-rate-limit.test.ts` —
  budget-true under cap, budget-false at and over cap, no increment
  side-effect, reset on stale-day, fail-open on infrastructure error.

### Fix 3 — F14-003 UsageTracker enforcement

- **`src/lib/usage-tracker.ts`** — new public exports:
  - `DAILY_USAGE_CAPS` per plan (`free` vs `pro`).
  - `PlanLimitExceededError` (carries `type`, `used`, `limit` for 429 payloads).
  - `checkUsage(userId, type)` reads the per-user counter at
    `daily_user_usage/{uid}_{YYYY-MM-DD}` and throws past cap.
    Fails OPEN on infrastructure errors.
  - `incrementUserUsage(userId, type, value)` — fire-and-forget
    per-user counter increment, plumbed into `logUsage` so existing
    `UsageTracker.trackGemini/trackImageGen/...` callers automatically
    populate the counter `checkUsage` reads.
- Wired into the three highest-cost AI routes today:
  - **`src/app/api/ai/assess-assignment/route.ts`** — `gemini_tokens`
    cap (gemini-2.5-pro multimodal is the priciest SKU in the stack;
    the F14 report flagged this route specifically).
  - **`src/app/api/ai/visual-aid/route.ts`** — `image_generation` cap;
    returns 429 with `code: 'PLAN_LIMIT_EXCEEDED'`.
  - **`src/app/api/ai/avatar/route.ts`** — `image_generation` cap;
    same 429 shape.
- **Test:** `src/__tests__/lib/usage-tracker-enforcement.test.ts` —
  under-cap passes, at-cap throws, pro plan honoured, anonymous user
  no-ops, infrastructure failure fails-open.

### Fix 4 — P1-4 shadow-diff TTL

- **`src/lib/sidecar/shadow-diff-writer.ts`** — every sample doc now
  carries `expiresAt = createdAt + 90 days` in addition to `createdAt`.
- **`firestore.indexes.json`** — fieldOverride with `ttl: true` added
  for each of the 17 agent collection groups (`visual-aid`, `vidya`,
  `lesson-plan`, `quiz`, `exam-paper`, `instant-answer`, `rubric`,
  `teacher-training`, `video-storyteller`, `virtual-field-trip`,
  `voice-to-text`, `worksheet`, `parent-message`, `avatar-generator`,
  `assessment-scanner`, `assignment-assessor`,
  `community-persona-message`). 90-day retention auto-applies once
  Firestore picks up the override.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean (0 errors) |
| 3 new test suites (17 tests) | All pass |
| Existing `visual-aid-dispatch` + `avatar-generator-dispatch` tests (20 tests) | Still pass |

## Follow-ups (not in this PR — flagged for next sprint)

1. **Wire `checkUsage` into the remaining AI routes.** The
   enforcement function and per-user counter are live, but only three
   routes currently call it (assess-assignment, visual-aid, avatar).
   The cheap-to-add high-value next set: `lesson-plan`,
   `instant-answer` (grounding!), `vidya`, `exam-paper`, `quiz`,
   `parent-message`, `teacher-training`, `worksheet`, `rubric`,
   `video-storyteller`, `virtual-field-trip`. Each is a 2-line edit:
   import `checkUsage`, call it after the userId check.
2. **Promotion-gate aggregator must accept smaller denominators.**
   With sampling now at 5%, the aggregator reads ~50 samples/day/agent
   instead of ~1,000. Re-validate that the parity score still has the
   statistical power needed for canary promotion decisions; if not,
   bump `SHADOW_DIFF_CANARY_SAMPLE_RATE` (and accept the cost) or
   change the gate to time-bucket-aware reads.
3. **Cost ceiling alerting.** `costService.trackDailyUsage` aggregates
   org-wide costs but nothing reads them and pages the on-call. Land
   a daily cron that compares the previous day's sum against a budget
   and alerts > 80% with a hard-stop > 100%.
4. **Deploy Firestore index/TTL config.** `firestore.indexes.json`
   changes need `firebase deploy --only firestore:indexes` to take
   effect on the live project.

## Files touched

```
firestore.indexes.json
src/app/api/ai/assess-assignment/route.ts
src/app/api/ai/avatar/route.ts
src/app/api/ai/visual-aid/route.ts
src/lib/server-safety.ts
src/lib/sidecar/assessment-scanner-dispatch.ts
src/lib/sidecar/assignment-assessor-dispatch.ts
src/lib/sidecar/avatar-generator-dispatch.ts
src/lib/sidecar/canary-shadow-diff.ts
src/lib/sidecar/community-persona-message-dispatch.ts
src/lib/sidecar/exam-paper-dispatch.ts
src/lib/sidecar/instant-answer-dispatch.ts
src/lib/sidecar/lesson-plan-dispatch.ts
src/lib/sidecar/parent-message-dispatch.ts
src/lib/sidecar/quiz-dispatch.ts
src/lib/sidecar/rubric-dispatch.ts
src/lib/sidecar/shadow-diff-writer.ts
src/lib/sidecar/teacher-training-dispatch.ts
src/lib/sidecar/video-storyteller-dispatch.ts
src/lib/sidecar/vidya-dispatch.ts
src/lib/sidecar/virtual-field-trip-dispatch.ts
src/lib/sidecar/visual-aid-dispatch.ts
src/lib/sidecar/voice-to-text-dispatch.ts
src/lib/sidecar/worksheet-dispatch.ts
src/lib/usage-tracker.ts
src/__tests__/lib/canary-shadow-diff-sample-rate.test.ts (new)
src/__tests__/lib/peek-image-rate-limit.test.ts (new)
src/__tests__/lib/usage-tracker-enforcement.test.ts (new)
```
