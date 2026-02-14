# Audit Report: Zone A (Core AI & Backend)

**Reviewers:** Synapse (AI) & Dr. Aris (Architecture)
**Date:** Feb 02, 2026
**Status:** ⚠️ Major Issues Found

---

## 1. Database Integration (The "Orphaned Data" Risk)
**Verdict:** ❌ FAILED
While `lesson-plan`, `quiz`, and `worksheet` were updated in Phase 4, the following flows are still using **Raw Firestore Calls** and need immediate refactoring to use `src/lib/db/adapter.ts`:
1.  `src/ai/flows/visual-aid-designer.ts` (Line 123)
2.  `src/ai/flows/virtual-field-trip.ts` (Line 92)
3.  `src/ai/flows/rubric-generator.ts` (Line 97)

**Risk:** Data saved by these flows might drift from the schema defined in `DATABASES_SCHEMA.md`.

## 2. Infrastructure & Safety
**Verdict:** ⚠️ WARNING
-   **Rate Limiting:** `lesson-plan-generator.ts` has explicit `checkServerRateLimit`. This logic is **MISSING** in `visual-aid-designer`, `virtual-field-trip`, and `rubric-generator`. A malicious user could drain our API quota by spamming these endpoints.
-   **Genkit Config:** `src/ai/genkit.ts` is using `gemini-2.5-flash` globally. Verify if `visual-aid` overrides this (it does: `gemini-3-pro-image-preview`, which is correct).

## 3. Flow-Specific Findings

| Flow | Status | Issues |
| :--- | :--- | :--- |
| `visual-aid-designer` | ❌ Critical | Raw DB call; Missing Rate Limit. |
| `virtual-field-trip` | ❌ Critical | Raw DB call; Missing Rate Limit. |
| `rubric-generator` | ❌ Critical | Raw DB call; Missing Rate Limit. |
| `agent-router` | ✅ Pass | Logic is sound. |
| `genkit.ts` | ✅ Pass | Clean configuration. |

---

## Action Items (Refactoring Plan)
1.  [ ] **Standardize DB:** Update the 3 failing flows to use `dbAdapter.saveContent()`.
2.  [ ] **Secure Endpoints:** Add `validateTopicSafety` and `checkServerRateLimit` to all generators, not just Lesson Plan.
