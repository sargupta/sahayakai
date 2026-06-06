# Q4C — Shadow-diff writes during canary AND full mode

**Branch:** `feature/q4c-shadow-diff-in-canary` (off `origin/develop`)

## Problem

Before Q4C the 17 sidecar dispatchers only wrote `agent_shadow_diffs`
records when `mode === 'shadow'`. In `canary` and `full` mode the
dispatcher ran sidecar primary with Genkit-fallback-on-error and
nothing parallel. Result: zero shadow_diff signal during canary
observation, so the per-promotion observation gate
(`agent_promotion_lifecycle.canMoveToFullSidecar`) had nothing to
evaluate and the canary→canary50→full ramp stalled.

## Change

For each of the 17 dispatchers in `src/lib/sidecar/*-dispatch.ts`:

1. **Decision interface gained `configuredMode`** — the raw flag
   value before bucket evaluation. Lets the dispatcher detect a
   canary "bucket-overshoot" (mode collapsed to `'off'` because
   `bucket >= percent`, but the agent is mid-canary) and still write
   a shadow_diff with `sidecar: null`-ish denominator.

2. **Canary/full sidecar-success path** — after sidecar serves the
   user, fire Genkit fire-and-forget and `writeAgentShadowDiff` with
   the `(sidecar, genkit)` pair.

3. **Canary "bucket-overshoot" Genkit-route** — when
   `decision.mode === 'off'` but `decision.configuredMode === 'canary'`,
   fire sidecar fire-and-forget and `writeAgentShadowDiff` with the
   `(genkit, sidecar)` pair so the rollup sees the right denominator.

4. **Centralised toggle** — `SHADOW_DIFF_IN_CANARY_OBSERVATION` in
   `src/lib/sidecar/canary-shadow-diff.ts`. Flip to `false`
   post-promotion to reclaim the 2× Gemini-call cost without ripping
   wiring out of all 17 dispatchers.

## Cost implication

Roughly **2× Gemini calls during canary AND full** because both stacks
run on every request. Intentional — observability during the rollout.
After every agent reaches full and the parity numbers are stable, flip
the constant in `canary-shadow-diff.ts` to recover the savings.

## Files touched

```
src/lib/sidecar/canary-shadow-diff.ts                       (new)
src/lib/feature-flags.ts                                    (+configuredMode on Vidya/LessonPlan decisions)
src/lib/sidecar/assessment-scanner-dispatch.ts
src/lib/sidecar/assignment-assessor-dispatch.ts
src/lib/sidecar/avatar-generator-dispatch.ts
src/lib/sidecar/community-persona-message-dispatch.ts
src/lib/sidecar/exam-paper-dispatch.ts
src/lib/sidecar/instant-answer-dispatch.ts
src/lib/sidecar/lesson-plan-dispatch.ts
src/lib/sidecar/parent-message-dispatch.ts
src/lib/sidecar/quiz-dispatch.ts
src/lib/sidecar/rubric-dispatch.ts
src/lib/sidecar/teacher-training-dispatch.ts
src/lib/sidecar/video-storyteller-dispatch.ts
src/lib/sidecar/vidya-dispatch.ts
src/lib/sidecar/virtual-field-trip-dispatch.ts
src/lib/sidecar/visual-aid-dispatch.ts
src/lib/sidecar/voice-to-text-dispatch.ts
src/lib/sidecar/worksheet-dispatch.ts
src/__tests__/lib/avatar-generator-dispatch.test.ts
src/__tests__/lib/instant-answer-dispatch.test.ts            (+Q4C suite)
src/__tests__/lib/lesson-plan-dispatch.test.ts
src/__tests__/lib/parent-message-dispatch.test.ts
src/__tests__/lib/quiz-dispatch.test.ts                      (+Q4C suite)
src/__tests__/lib/video-storyteller-dispatch.test.ts
src/__tests__/lib/vidya-dispatch.test.ts
src/__tests__/lib/voice-to-text-dispatch.test.ts
```

## Verification

* `npx tsc --noEmit` — clean.
* `npx jest --testPathPatterns="dispatch.test"` — **205 / 205 pass**.
* Per-dispatcher audit — every one of the 17 has both
  `configuredMode === 'canary'` block (off-branch) and a
  `SHADOW_DIFF_IN_CANARY_OBSERVATION` block (canary/full success):
  see the audit run in the commit history.

## Follow-up

1. Push branch + PR into `develop`.
2. After deploy, run a synthetic load against canary'd agents and
   verify `agent_shadow_diffs/{date}/{agent}/*` populates for
   non-`shadow` modes.
3. Once every agent reaches `full` and the lifecycle gate clears,
   set `SHADOW_DIFF_IN_CANARY_OBSERVATION = false` to reclaim the 2×
   Gemini cost.

## Commits on this branch

```
80616e40f feat(sidecar): add configuredMode to dispatch decisions for Q4C
6fe3610e0 feat(sidecar): write shadow_diff during canary AND full mode (Q4C)
54875a624 fix(vidya): use input.uid + mint App Check token for canary-overshoot shadow (Q4C)
0c7947d64 fix(video-storyteller): handle optional userId + add canary/full Q4C observation
89d473bb2 fix(lesson-plan): wire Q4C canary-observation hooks (anchors differ)
a0a21e12e test(sidecar): update dispatcher tests for Q4C canary/full observation
```

(The branch also carries one unrelated pre-existing commit
`bfe690350 feat(q3e): cost attribution labels…` picked up via the
shared working tree; squash or rebase out before opening the PR.)
