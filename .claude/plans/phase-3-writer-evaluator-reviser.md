# Phase 3 — Writer-Evaluator-Reviser loop for lesson plans

## Headline

Wrap the existing single-shot Genkit `generateLessonPlan` flow in a three-agent loop: a **writer** drafts, an **evaluator** scores against a pedagogical rubric, a **reviser** refines based on critique. Two iterations max. Same wire contract; same ADK Python sidecar architecture as Phase 1.

## Why

The current `src/ai/flows/lesson-plan-generator.ts` is a one-shot prompt. Output quality is the model's first attempt, with no critic in the loop. Teachers (per the standing peer-review rule that Codex + Gemini find prod bugs Claude misses) routinely report:

- Outcomes that don't match the stated grade level.
- Activities that ignore the resource level (low / medium / high).
- Hindi versions that read like literal English translations rather than natural Hindi pedagogy.
- Assessment items that don't map to the listed objectives.

Each of those is a problem an evaluator agent could detect and route back for revision. The Hierarchical-Supervisor + Reflection pattern (the dominant 2026 agentic pattern per the SDK research from earlier in this branch) is the right fit.

## Scope

### In

- New ADK `LlmAgent` triplet: `writer`, `evaluator`, `reviser`.
- Sequential agent that runs `writer → evaluator → (reviser if score < gate)` for at most two evaluator passes.
- Pedagogical rubric: 8 axes scored [0, 1] by the evaluator.
- Cost cap: max 3 model calls per lesson plan (writer + evaluator + at most 1 reviser).
- Behavioural guard at the end (no AI self-references, language-script match, length sanity).
- Sidecar route `POST /v1/lesson-plan/generate` — same shape as the parent-call sidecar; wraps the existing Genkit input/output schema.
- Feature flag `lessonPlanSidecarMode` (off / shadow / canary / full) — same dispatcher pattern as Phase 1.

### Out (Phase 3.1+)

- Worksheet generator and quiz generator (same pattern; separate ramp plans).
- Multi-modal lesson plans (image + text). Phase 3 stays text-only.
- RAG grounding (covered in Phase 4 — Phase 3's evaluator scores against the rubric, not against curriculum standards).

## Architecture

```
                    ┌─── Sequential Agent ──────────────────────────┐
                    │                                                │
   user input ──►   │  Writer (LlmAgent)                             │
                    │     └─► draft v1                               │
                    │                                                │
                    │  Evaluator (LlmAgent)                          │
                    │     ├─ scores draft against 8-axis rubric      │
                    │     └─► {scores, fail_reasons, pass_overall}   │
                    │                                                │
                    │  if pass_overall:                              │
                    │      return draft v1                           │
                    │  else if pass_count >= GATE:                   │
                    │      return draft v1 (with score breakdown)    │
                    │  else:                                         │
                    │      Reviser (LlmAgent)                        │
                    │         ├─ takes (draft v1, fail_reasons)      │
                    │         └─► draft v2                           │
                    │                                                │
                    │      Evaluator runs once more on v2 (optional) │
                    │                                                │
                    └────────────────────────────────────────────────┘
                                          │
                                          ▼
                          Behavioural guard (script match, length)
                                          │
                                          ▼
                                  return final draft
```

ADK Python (`google-adk` 1.31+) ships `SequentialAgent` and `LoopAgent` primitives that match this shape. The triplet itself is three `LlmAgent` instances pinned to the same model (default `gemini-2.5-flash`); the orchestrator routes between them based on the evaluator's pass-overall flag.

## Pedagogical rubric (8 axes)

Pinned in `sahayakai-agents/prompts/lesson-plan/evaluator.handlebars`. Each axis returns a float in [0, 1] plus a one-line rationale:

1. **grade_level_alignment** — language complexity, examples, time budget appropriate to the stated grade.
2. **objective_assessment_match** — every assessment item maps to at least one stated learning objective.
3. **resource_level_realism** — activities are achievable with the stated resource level (e.g. no projector for `low`).
4. **language_naturalness** — when language is Hindi/Indic, the prose reads as native pedagogy, not literal translation.
5. **scaffolding_present** — moves from concrete → abstract; gives at least one worked example before independent practice.
6. **inclusion_signals** — accommodates mixed-ability learners; offers extensions and supports.
7. **cultural_appropriateness** — examples respect Indian context (festivals, foods, agricultural cycles when applicable).
8. **safety** — free of harmful framing; no body-shaming, no caste/religion reinforcement.

**Gate:**
- Overall pass requires **>= 6 axes >= 0.80** AND **safety axis = 1.0**.
- Soft-fail (revise) requires **safety = 1.0** but score below the overall gate.
- Hard-fail (refuse) when safety < 1.0 OR fewer than 4 axes >= 0.80 — return canned safe response, log as a behavioural event, do not surface the model's text to the teacher.

## Sub-phases

### 3.0 Design + Genkit baseline (3 days)

- This document.
- Capture 30 lesson-plan (input, output) pairs from production Genkit traffic. Anonymise; commit as `sahayakai-agents/tests/fixtures/lesson_plan_pairs.json`.
- Hand-grade each baseline pair against the 8-axis rubric. The evaluator's calibration target is to match human scores on this set within ±0.10 mean absolute error.

### 3.1 Sidecar route (3 days)

- `sahayakai-agents/src/sahayakai_agents/agents/lesson_plan/` package mirroring `agents/parent_call/`:
  - `agent.py` — defines the three `LlmAgent` instances (writer, evaluator, reviser) and the orchestrating `SequentialAgent`.
  - `router.py` — FastAPI sub-router at `POST /v1/lesson-plan/generate`. Same `run_resiliently` wrapping; same OCC pattern adapted from parent-call.
  - `schemas.py` — Pydantic schemas for input + output. `LessonPlanRequest` mirrors the existing Genkit input shape so the migration is byte-aligned.
- Shared prompts: `sahayakai-agents/prompts/lesson-plan/{writer,evaluator,reviser}.handlebars`. The writer prompt is the existing Genkit prompt verbatim; evaluator + reviser are new.

### 3.2 Behavioural guard (1 day)

- Extend `_behavioural.py` with `assert_lesson_plan_rules(plan, language)`:
  - Forbidden phrases (same as parent-call: no AI self-references).
  - Script-match per `language` (same Unicode ranges).
  - Length bounds (200-2000 words; outside is suspect).
  - All 8 evaluator-axis flags propagate as a structured `BehaviouralGuardError` axis tag.

### 3.3 Genkit dispatcher integration (2 days)

- TypeScript side mirrors the Phase 1 pattern:
  - `src/lib/sidecar/lesson-plan-client.ts` — HTTP client to the sidecar route. Same HMAC signing, same ID-token mint, same 8-second timeout (lesson plans are not phone-call-bound — wider budget OK).
  - `src/lib/sidecar/lesson-plan-dispatch.ts` — off / shadow / canary / full dispatcher. Same fail-closed semantics on behavioural errors.
  - `src/ai/flows/lesson-plan-generator.ts` route consumer swapped to call the dispatcher.

### 3.4 Parity + tests (3 days)

- `sahayakai-agents/scripts/compare_lesson_plan_parity.py` — three-tier scoring (TF cosine, IndicSBERT embedding, Gemini-judge). Reuses the `compare_parity.py` infrastructure from Phase 1 — refactor those tier classes into a shared `evaluation/scorers.py` first.
- 30 fixtures from 3.0 are the gate set.
- Dispatcher unit test for the four-mode matrix (same shape as parent-call dispatcher test).
- Behavioural test for the rubric: hand-craft 5 plans known to violate each rubric axis; assert the evaluator catches each.

### 3.5 Track G ramp (10-14 days)

- Auto-abort wired with two new policies:
  - `lesson_plan_revise_rate > 50%` (15m) — too many drafts failing the evaluator means the rubric is mis-calibrated or the writer prompt has drifted.
  - `lesson_plan_p95 > 12s` (15m) — three sequential model calls compounds latency; > 12s means the user-visible wait is unacceptable.
- Same demotion ladder as Phase 1.
- Ramp: `shadow@5% → 25% → 50% → canary@5% → 25% → full`.

## Risks

### High

- **Latency** — three sequential model calls vs one. p95 budget for lesson plans today is ~5s; the loop pushes it to ~12-15s. The first draft is good enough most of the time; 3.0's calibration measures how often the evaluator actually triggers a revise (target: < 30%, so the median latency stays close to the writer + evaluator path only).
- **Cost** — 2-3× the per-call spend of the current single-shot. Cloud Monitoring spend alert at 2.5× baseline.
- **Evaluator over-strictness** — a too-strict evaluator triggers revisions that don't measurably improve quality. **Mitigation:** the 30-fixture human-graded calibration set in 3.0 is the ground truth; we tune the rubric thresholds against it.

### Medium

- **Reviser hallucinations** — the reviser, given a draft and a critique, can introduce *new* errors while fixing old ones. **Mitigation:** evaluator runs ONE more time on the revision; if v2 still fails, return v1 with the score breakdown (we never amplify; the worst case is we ship the original draft).
- **Prompt drift across writer / evaluator** — the writer + evaluator share grade-level / language conventions. If they drift apart, evaluator scoring becomes noise. **Mitigation:** the same Handlebars template variables are passed to both; a CI test asserts they share a header partial.

### Low

- **Multi-language evaluator** — the rubric prose is in English regardless of the lesson plan language. The evaluator scores Hindi plans against the same rubric. Calibration set covers all 11 languages so we catch eval bias.

## Estimated effort

- 3.0 design + baseline: **3 days**
- 3.1 sidecar route + agent triplet: **3 days**
- 3.2 behavioural guard: **1 day**
- 3.3 Genkit dispatcher: **2 days**
- 3.4 parity + tests: **3 days**
- 3.5 ramp: **10-14 days**

**Total: ~2-3 weeks engineering + 2-week ramp = 4-5 weeks calendar.**

## Dependencies

- Phase 1 must be ramped to 100% on parent-call so the dispatcher pattern is proven; we copy it.
- The shared `evaluation/scorers.py` extraction from Phase 1's `compare_parity.py` is a prerequisite — schedule the refactor in 3.0.
- 30-fixture human-grading session (3.0) — needs a pedagogy SME (the user) for ~half a day.

## Files this plan implies (forward inventory)

```
sahayakai-agents/
  src/sahayakai_agents/
    agents/lesson_plan/
      __init__.py
      agent.py
      router.py
      schemas.py
    evaluation/
      scorers.py                            (extracted from compare_parity.py)
    _behavioural.py                         (extend)
  prompts/lesson-plan/
    writer.handlebars
    evaluator.handlebars
    reviser.handlebars
  scripts/
    compare_lesson_plan_parity.py
  tests/
    fixtures/lesson_plan_pairs.json          (30 hand-graded)
    integration/test_lesson_plan_router.py
    behavioral/test_evaluator_rubric.py

sahayakai-main/
  src/lib/sidecar/
    lesson-plan-client.ts
    lesson-plan-dispatch.ts
  src/__tests__/lib/
    lesson-plan-dispatch.test.ts
  src/ai/flows/
    lesson-plan-generator.ts                 (route through dispatcher)
```

## Pre-kickoff gates

1. Phase 1 parent-call at 100% in production for at least 7 days with no auto-abort fires.
2. 30 hand-graded lesson-plan fixtures committed.
3. Latency budget signed off: lesson plans up to p95 12s acceptable for the user-visible wait; if not we cap revisions at 0 (writer + evaluator only).
4. Cost projection within 3× of current single-shot baseline.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
