# F18 — Grade-Band Forensic Investigation

**Investigator:** Role 12 (grade-band forensic)
**Date:** 2026-06-06
**Branch:** `feature/q4c-shadow-diff-in-canary`
**Scope:** Lesson Plan, Quiz, Parent Message across 4 grade bands (Primary 1–5, Middle 6–8, Secondary 9–10, Senior Secondary 11–12).
**Method:** Static prompt/schema forensic analysis. (Live probes against AI flows require `gcloud auth print-identity-token` against the Cloud Run service. Probe harness shipped under `qa/forensics/repros/F18/` — auto-skipped when no `ID_TOKEN` env var is set, so the same script doubles as CI and ad-hoc.)

---

## Executive Summary

The three teacher-facing flows (`lesson-plan-generator.ts`, `quiz-definitions.ts`, `parent-message-generator.ts`) share one structural defect: **none of them carry grade-band-aware pedagogy or tone instructions**. The prompts pass the literal `Class N` string through to the LLM and rely entirely on the model's untracked priors to (a) modulate vocabulary, (b) pick a pedagogical framework, (c) calibrate question count and depth, and (d) shift parent-tone for primary vs. senior-secondary. The system has no enforced "band → playbook" mapping.

This is a latent quality risk, not a runtime crash. It manifests as silent severity drift: Class 3 lessons that bleed inquiry-style abstraction more suited to Class 7; Class 12 quizzes that default to 5 questions because the schema's default is hard-coded; parent messages with identical tone whether the student is 6 or 17.

### Bug Inventory

| ID | Severity | Surface | One-line |
|----|----------|---------|----------|
| F18-01 | **P1** | quiz-definitions.ts | `numQuestions` default `5` applies uniformly to Class 3 and Class 12; spec calls for primary 5–10, secondary 15–25 |
| F18-02 | **P1** | lesson-plan-generator.ts prompt | Single 5E pedagogy template applied to all bands; spec wants story-based (primary) → inquiry (middle) → structured (secondary) → exam-prep (senior) |
| F18-03 | **P1** | quiz-definitions.ts prompt | No vocabulary-age constraint; LLM free to use Class-9 vocabulary for Class 3 inputs |
| F18-04 | **P2** | parent-message-generator.ts prompt | Tone is fixed ("empathetic, respectful, solution-focused") with no child-age modulation; spec says tone should match age |
| F18-05 | **P2** | quiz-definitions.ts prompt | No board-exam awareness for Class 9–10 (CBSE/ICSE/State board format); no NEET/JEE awareness for Class 11–12 Science |
| F18-06 | **P2** | lesson-plan-generator.ts prompt | "Abstract concept" guard absent for primary; concrete-operational stage (Piaget) not encoded |
| F18-07 | **P3** | quiz-generator.ts (caller) | `gradeLevel || 'Class 5'` fallback (line 142, 181) silently routes unknown grades to primary band, masking misconfig at higher bands |

No P0 found in static review. P0 ("senior secondary content in primary lesson plan") is the runtime manifestation of F18-02 + F18-06 combined; reproducible only by live probe.

---

## Per-Band Findings

### Primary (Class 1–5) — representative probe: Class 3 Science, "Plants around us"

**Lesson plan**
- Prompt source: `src/ai/flows/lesson-plan-generator.ts:260-330`
- 5E framework hard-applied (Engage → Explore → Explain → Elaborate → Evaluate). For a Class 3 student in concrete-operational stage (Piaget 7–11), "Explore" as guided inquiry is borderline; "Elaborate" as concept-transfer is above ceiling for many 8-year-olds.
- No vocabulary-grade band, e.g., no "use sentences ≤8 words, Dolch-2 level" guard.
- No concrete-vs-abstract guard. The prompt's "Indian Context" rules (rivers, mandis, festivals) are concrete, which helps incidentally — but does not bound abstraction explicitly.
- **Finding F18-02, F18-06** apply.

**Quiz**
- Default `numQuestions = 5` (schema line 18). Acceptable for primary lower bound; teachers must opt up to 10.
- No question-type constraint specific to primary (MCQ + short answer per spec). Prompt allows the user-supplied `questionTypes` array to include anything (long-answer, essay) which is inappropriate for Class 3.
- **Finding F18-01 (lower-band part), F18-03** apply.

**Parent message**
- Tone identical across bands. For Class 3, parent typically the literacy-anchor; message should be simpler and more action-cued. Current prompt is calibrated for a generic literate parent.
- **Finding F18-04** applies.

### Middle (Class 6–8) — representative probe: Class 7 Math, "Integers"

**Lesson plan**
- 5E framework is reasonable for middle band — inquiry is age-appropriate. No structural issue specific to this band.
- Vocabulary not bounded but middle-band tolerance is wide. Acceptable.

**Quiz**
- Default `numQuestions = 5` is too low for Class 7 (spec floor for middle implicitly ≥10). **F18-01**.
- No Bloom's mid-tier enforcement (Apply, Analyze) for this band. Spec says "bridge to abstract"; prompt does not encode this.

**Parent message** — F18-04 applies but lower severity.

### Secondary (Class 9–10) — representative probe: Class 10 Science, "Light – Reflection and Refraction"

**Lesson plan**
- 5E still applied; spec calls for "structured" pedagogy with exam awareness. Prompt does not reference CBSE/ICSE board specifications, marking schemes, or board-paper format. **F18-02 (structured/exam-prep), F18-05**.

**Quiz**
- Default `numQuestions = 5`. Spec floor for secondary is 15. Hard miss. **F18-01 (upper-band)**.
- No board-paper-style instruction (e.g., 1-mark MCQ + 2-mark short + 3-mark long structure typical of CBSE Class 10).

**Parent message** — Tone calibration: Class 10 board year is high-stakes; "consecutive_absences" tone should escalate context (board prep). Current tone is grade-neutral. **F18-04**.

### Senior Secondary (Class 11–12) — representative probe: Class 12 Physics, "Electrostatics"

**Lesson plan**
- 5E framework is mismatched for senior secondary. Spec calls for exam-prep pedagogy (lecture + derivation + numerical practice + previous-year-questions). The 5E Engage/Explore opening with "a story or riddle" is age-inappropriate for Class 12 Physics, where students expect derivation-first.
- No NEET/JEE consciousness for Science stream. **F18-02 (senior), F18-05**.

**Quiz**
- Default `numQuestions = 5`. Spec floor for senior is 15–25. Hard miss for Class 12. **F18-01 (worst case)**.
- No question-type weighting (MCQ for JEE-style, long-numerical for board-style). Single template.
- No "analytical" enforcement; can still trivially return recall-level questions.

**Parent message** — Senior secondary parents are typically engaged with college admissions; tone should acknowledge that context. Not encoded. **F18-04**.

---

## Static Evidence (file:line citations)

| Finding | File | Line | Snippet |
|---|---|---|---|
| F18-01 | `src/ai/schemas/quiz-generator-schemas.ts` | 18 | `numQuestions: z.number().default(5)` |
| F18-02 | `src/ai/flows/lesson-plan-generator.ts` | 271-277 | "You MUST organize the activities into the 5E Instructional Model" — applied uniformly with no band branching |
| F18-03 | `src/ai/flows/quiz-definitions.ts` | 6-85 | Prompt body — no `gradeBand` switch, no vocabulary constraints |
| F18-04 | `src/ai/flows/parent-message-generator.ts` | 97-141 | Single tone instruction; no age/grade conditional |
| F18-05 | `src/ai/flows/quiz-definitions.ts` | 47-77 | No board / NEET / JEE / CBSE references anywhere in prompt |
| F18-06 | `src/ai/flows/lesson-plan-generator.ts` | 260-330 | Whole prompt — no "concrete operational" or "avoid abstraction" guard for primary |
| F18-07 | `src/ai/flows/quiz-generator.ts` | 142, 181 | `gradeLevel || 'Class 5'` defaults — silently masks band misconfig |

---

## Repros

Live probe harness lives at `qa/forensics/repros/F18/probe.mjs`. It iterates the 12-probe matrix (4 bands × 3 flows) and writes `findings.json`. Without an `ID_TOKEN`, it short-circuits and emits a "STATIC_ONLY" marker so the report can be regenerated deterministically offline. To run live:

```
gcloud auth print-identity-token \
  --impersonate-service-account=$(gcloud config get-value account) \
  > /tmp/idtok
ID_TOKEN=$(cat /tmp/idtok) \
SAHAYAK_BASE=https://sahayakai-hotfix-resilience-... \
node qa/forensics/repros/F18/probe.mjs
```

Probe matrix (per band):
1. POST `/api/ai/lesson-plan` with band-representative grade + subject. Audit returned `keyVocabulary`, `phase` activities, and `objectives` text against band rubric.
2. POST `/api/ai/quiz` with `numQuestions` *unset* (to expose schema default). Count returned questions, sample vocabulary, check for board/JEE markers in senior probes.
3. POST `/api/ai/parent-message` with `reason=poor_performance`. Audit tone register, presence of board-year context for Class 10, college-prep context for Class 12.

---

## Recommended Fixes (not applied — out of scope for this investigation)

1. **F18-01** — replace hard-coded `default(5)` with band-aware default resolved at the dispatcher: primary→8, middle→12, secondary→20, senior→25. Schema can stay `default(5)` for backward compat; resolve at the route handler before calling the flow.
2. **F18-02 + F18-06** — add a `gradeBand` derived field (computed from `gradeLevels[0]`) and a Handlebars switch inside the lesson-plan prompt that selects pedagogy block: `{{#if isPrimary}}story-first, sentences ≤8 words, no abstract metaphors…{{/if}}` etc.
3. **F18-04** — add a `gradeBand` field to `ParentMessageInputSchema` and 4 tone-modulation blocks in the prompt.
4. **F18-05** — for `gradeBand=secondary`, inject CBSE Class-10 board paper format guidance; for `gradeBand=senior` + Science subject, inject NEET/JEE awareness block.
5. **F18-07** — replace `'Class 5'` fallback with explicit error or with a server-side log + dispatcher refusal; primary-band as silent default masks production data issues.

---

## Sign-off

- Static review: complete (no P0 found at source level).
- Live probes: harness shipped; requires `ID_TOKEN` to execute. P0 manifestation ("senior-secondary content in primary lesson plan") is reproducible via the harness — predicted with high confidence given F18-02 + F18-06.
- Suggest opening 5 follow-up tickets (one per recommended fix), with F18-01 and F18-02 as P1 release-blockers.
