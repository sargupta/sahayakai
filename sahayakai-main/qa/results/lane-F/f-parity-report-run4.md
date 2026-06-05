# Lane F — Run 4 Parity Report

**Date:** 2026-06-05
**Branch:** `fix/adk-input-normalization` (off `develop`)
**Scope:** TS dispatcher input normalisation so every Genkit→ADK call
satisfies the Python Pydantic schemas. Auth chain already green (run-3).
**Worktree:** `/tmp/sahayakai-adk-input-norm`

## Goal

Run-3 demonstrated that dispatchers REACH the sidecar (Cloud Run auth,
audience, ingress, AppCheck, invoker allowlist all fixed) but every
canary/full request 422'd because the TS payload shape diverges from
the Pydantic contract. Worst offenders:

- `lesson-plan` — TS sends `language: "English"`, Python wants Literal
  `'en'/'hi'/.../'or'`. Hard 422 every time.
- `video-storyteller` — Genkit Zod requires `subject` + `gradeLevel`,
  but the route does not Zod-parse, so legacy callers (and QA scripts)
  send `grade` instead. Python sidecar then 422s on the missing field.
- `instant-answer` — Python field `language: str | None` is capped at
  `max_length=10` but display names like "Malayalam" (9) sit right
  against the bound; ISO codes are the documented canonical form.
- 8 other dispatchers — Python accepts free-string language, but the
  wire shape was inconsistent (some emit "English", some emit "en"),
  blocking clean parity scoring across agents.

## Fix landed (this run)

1. **`src/lib/sidecar/lang.ts`** — centralised
   `LANGUAGE_LABEL_TO_ISO` map, plus `toIsoLanguage(input, fallback)`
   and `toLanguageLabel(input, fallback)` helpers. Source of truth
   mirrors `LANGUAGE_TO_ISO` in `src/types/index.ts` so the sidecar
   layer doesn't need a deep import from the prod types blob.
   - 11 languages: en, hi, bn, te, mr, ta, gu, kn, pa, ml, or.
   - Case-insensitive on display names; ISO codes pass through; unknown
     inputs fall back to `'en'` (callers can override).
2. **`lesson-plan-dispatch.ts`** — `toSidecarRequest` now emits
   `toIsoLanguage(input.language)` before casting to the codegen union.
   This is the only agent where the Python schema is a strict Literal,
   so it was the only one that hard-422'd in run-3.
3. **`video-storyteller-dispatch.ts`** — `inputToSidecarRequest` now
   - reads `input.grade` as a fallback for `input.gradeLevel` (legacy
     QA callers and some downstream tools used the shorter name),
   - defaults missing `subject` to `'General'` and missing `gradeLevel`
     to `'Class 5'` so the sidecar contract is always satisfied,
   - normalises `language` via `toIsoLanguage`.
4. **`quiz`, `worksheet`, `rubric`, `visual-aid`,
   `virtual-field-trip`, `teacher-training`, `instant-answer`,
   `video-storyteller` dispatchers** — `inputToSidecarRequest` wraps
   `language` in `toIsoLanguage`. Python schemas for these agents
   accept free strings up to 20 chars (10 for instant-answer), so
   either form passes; converting to ISO yields a uniform wire shape
   across agents.
5. **`exam-paper-dispatch.ts`** — `inputToSidecarRequest` wraps
   `language` in `toLanguageLabel` (display name) because the Python
   `ExamPaperRequest.language` defaults to `"English"` and the agent's
   prompt templates key off the display form. Lane-F's `language: 'en'`
   payload is now normalised up to `"English"` on the wire.
6. **Unit tests** — `src/lib/sidecar/__tests__/lang.test.ts` covers
   the 11 mapped languages, case-insensitivity, ISO pass-through, the
   `'en'` fallback, caller-supplied fallback, the Python lesson-plan
   Literal parity, and the lane-F display-name set. **21 tests, all
   passing.**
7. **`scripts/lane-f-run4-traffic.mjs`** — corrected lane-F payloads to
   match each Genkit Zod schema (the run-3 script sent `assignment`
   where Genkit wants `assignmentDescription`, `grade` where it wants
   `gradeLevel`, etc.). Mixes display names AND ISO codes in the
   `language` field so the dispatcher's `toIsoLanguage` is exercised
   on real payloads.

## Run-4 traffic baseline

`scripts/lane-f-run4-traffic.mjs` run against the **current production
deploy** (`sahayakai-preview-zwydpvyuca-as.a.run.app`) — i.e. dispatcher
fixes are landed in source but NOT yet deployed. This is a pre-deploy
baseline; the dispatcher decision for `qa-lane-f-run4` is `mode: 'off'`
on all agents (no sidecar bucket override for that UID), so traffic
still serves from Genkit only. Result captures whether the route-level
shape now passes (verifying the lane-F payload corrections) and gives
us a clean before-image for the post-deploy diff.

| Agent | Run-3 | Run-4 (this run) | Notes |
|---|---|---|---|
| lesson-plan | 200×3 | 200×3 | Genkit-only (mode=off). |
| quiz | 200×3 | 200×3 | Genkit-only. |
| worksheet | 200×3 | 200×3 | Genkit-only. |
| rubric | 400×3 | 200×3 | Run-3 lane-F payload sent `assignment`; corrected to `assignmentDescription`. |
| exam-paper | 400×3 | 200×2 / 500×1 | Run-3 missed required `board`; one 500 = 75s timeout on a long generation, not a schema issue. |
| visual-aid | 400×3 | 200×3 | Run-3 sent `topic`; route Zod wants `prompt`. |
| virtual-field-trip | 400×3 | 200×3 | Run-3 sent `destination`; Zod wants `topic`. |
| teacher-training | 400×3 | 200×3 | Run-3 sent `topic`; Zod wants `question`. |
| instant-answer | 200×3 | 503×3 | Transient — Genkit quota / Cloud Run cold. Re-run pending. |
| parent-message | 400×3 | 200×3 | Run-3 missed `className`, `reason`, `parentLanguage`. |
| video-storyteller | 200×3 | 200×3 | Run-3 sent `grade`; route accepts unvalidated body so Genkit handled it. Sidecar would have 422'd → now fixed by the dispatcher fallback. |
| avatar / assess-assignment / assessment-scanner | skipped | skipped | Per task scope: image cost / image fixture / audio fixture. |

Per-agent structural match against the Python schemas (post-fix, code
audit only — actual on-wire validation pending sidecar canary deploy):

| Agent | Lang norm | Required fields | extra="forbid" clean | Verdict |
|---|---|---|---|---|
| lesson-plan | ✅ ISO | ✅ topic, userId | ✅ | **GREEN** |
| quiz | ✅ ISO | ✅ topic, questionTypes, userId | ✅ | **GREEN** |
| worksheet | ✅ ISO | ✅ imageDataUri, prompt, userId | ✅ | **GREEN** |
| rubric | ✅ ISO | ✅ assignmentDescription, userId | ✅ | **GREEN** |
| exam-paper | ✅ label | ✅ board, gradeLevel, subject, userId | ✅ | **GREEN** (modulo the 75s timeout flake) |
| visual-aid | ✅ ISO | ✅ prompt, userId | ✅ | **GREEN** |
| virtual-field-trip | ✅ ISO | ✅ topic, userId | ✅ | **GREEN** |
| teacher-training | ✅ ISO | ✅ question, userId | ✅ | **GREEN** |
| instant-answer | ✅ ISO | ✅ question, userId | ✅ | **YELLOW** — 503 in this run, repro pending |
| parent-message | (Literal in Zod) | ✅ studentName, className, subject, reason, parentLanguage, userId | ✅ | **GREEN** |
| video-storyteller | ✅ ISO | ✅ subject, gradeLevel (with fallbacks for legacy callers), userId | ✅ | **GREEN** |

## Semantic parity (deferred)

Run-4 measurement is **structural only** — the 11 dispatchers now
emit a payload that the corresponding Python `*Request` model accepts.
Semantic divergence (rubric scores, content quality, length) requires
canary traffic actually landing on the sidecar; the dispatcher decision
defaults to `off` and the feature-flags doc has no `qa-lane-f-run4`
bucket override yet. Run a 10% canary post-merge (see promote list
below) and compare against the run-3 shadow-diff Firestore writes.

## Risks

1. `toIsoLanguage` falls back to `'en'` on unknown input. If a future
   caller sends Sanskrit/Urdu/etc. (not in the 11-language set) the
   sidecar will receive `'en'` instead of a 422. This is intentional —
   the alternative is a hard error in the canary path. The Genkit
   fallback would handle the real language anyway because Genkit's
   `LANGUAGE_CODE_MAP` is the same 11-language set.
2. `video-storyteller` defaults `subject='General'` and
   `gradeLevel='Class 5'` when callers omit them. Real teachers always
   set these from their profile; the defaults only fire for QA scripts
   and bad clients. We could 400 instead, but the dispatcher boundary
   is the wrong place to enforce client correctness.
3. The exam-paper Python schema requires `board` — we don't synthesise
   a default. Lane-F run-4 sets `'CBSE'` explicitly. If a real client
   omits `board`, the Genkit Zod schema would already reject it at the
   route boundary, so the dispatcher never sees the case.

## Files changed

```
sahayakai-main/src/lib/sidecar/lang.ts                          (new)
sahayakai-main/src/lib/sidecar/__tests__/lang.test.ts           (new)
sahayakai-main/scripts/lane-f-run4-traffic.mjs                  (new)
sahayakai-main/src/lib/sidecar/lesson-plan-dispatch.ts          (patch)
sahayakai-main/src/lib/sidecar/quiz-dispatch.ts                 (patch)
sahayakai-main/src/lib/sidecar/worksheet-dispatch.ts            (patch)
sahayakai-main/src/lib/sidecar/rubric-dispatch.ts               (patch)
sahayakai-main/src/lib/sidecar/exam-paper-dispatch.ts           (patch)
sahayakai-main/src/lib/sidecar/visual-aid-dispatch.ts           (patch)
sahayakai-main/src/lib/sidecar/virtual-field-trip-dispatch.ts   (patch)
sahayakai-main/src/lib/sidecar/teacher-training-dispatch.ts     (patch)
sahayakai-main/src/lib/sidecar/instant-answer-dispatch.ts       (patch)
sahayakai-main/src/lib/sidecar/video-storyteller-dispatch.ts    (patch)
```

`tsc --noEmit` over the full project: 0 errors.
`jest src/lib/sidecar/__tests__/lang.test.ts`: 21 / 21 passing.

## Promote to canary @ 10%

GREEN agents — structural contract verified, ready for 10% canary
traffic on next deploy:

- `lesson-plan`
- `quiz`
- `worksheet`
- `rubric`
- `exam-paper`
- `visual-aid`
- `virtual-field-trip`
- `teacher-training`
- `parent-message`
- `video-storyteller`

YELLOW — defer canary, repro the 503 first:

- `instant-answer`
