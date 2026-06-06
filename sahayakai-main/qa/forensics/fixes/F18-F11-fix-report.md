# F18 + F11 P1 Fix Report

Branch: `fix/F18-F11-p1-fixes` (off `develop`).
Worktree: `.claude/worktrees/F18-F11-p1-fixes`.

## Summary

Seven P1 fixes from the F18 (grade bands) and F11 (onboarding profile) forensic
reports. All shipped behind unit tests; `npm run typecheck` clean; 22 new tests
+ 44 pre-existing related tests pass.

## Fixes

### F18-01 — Grade-aware `numQuestions` default
- **File:** `src/lib/grade-bands.ts` (new), `src/ai/flows/quiz-generator.ts`.
- New `defaultNumQuestionsForGrade()` helper:
  - Primary (1-5) → 5
  - Middle (6-8) → 10
  - Secondary (9-10) → 15
  - Senior (11-12) → 20
- Override applied in `generateQuiz()` BEFORE schema validation, so the
  caller's explicit value still wins; only `undefined`/`null` triggers the
  band-derived default.
- The schema `.default(5)` is preserved as a last-resort fallback (e.g.
  if `gradeLevel` is also absent).

### F18-02 — Band-specific pedagogy framework
- **File:** `src/lib/grade-bands.ts` (new), `src/ai/flows/lesson-plan-generator.ts`.
- New `getPedagogyFrameworkBlock(band)` returns a Markdown block for the
  prompt:
  - **Primary** — story-based + concrete examples (5E phases reinterpreted
    as Story Hook / Show & Tell / Guided Practice / Play & Apply / Recall).
  - **Middle** — original 5E inquiry model.
  - **Secondary** — structured + board-exam prep (mark allocation, common
    pitfalls, NCERT exercise alignment).
  - **Senior** — deep analysis + competitive-exam awareness (JEE/NEET/CUET
    strategy notes, two-tier worked examples).
- All four bands map to the existing 5E phase enum so the activity schema
  doesn't have to change — only the *content* of each phase shifts.
  Verified by unit test (`every band still uses the 5E phase vocabulary`).
- `pedagogyFrameworkBlock` + `gradeBandLabel` added to `LessonPlanInputSchema`
  as optional server-derived fields; populated in `generateLessonPlan()` from
  `gradeLevels[0]` before the flow is invoked.
- Prompt template now renders `{{{pedagogyFrameworkBlock}}}` when present
  and falls back to the hard-coded 5E block when absent (so older call
  sites that don't go through `generateLessonPlan` still produce a valid
  plan).

### F18-03 — Vocabulary-age constraint in quiz prompt
- **File:** `src/ai/schemas/quiz-generator-schemas.ts`,
  `src/ai/flows/quiz-generator.ts`, `src/ai/flows/quiz-definitions.ts`.
- Added optional server-derived `gradeBandLabel` to
  `QuizGeneratorInputSchema`, populated by `generateQuiz()` from
  `gradeLevel` via `getBandDisplayLabel(getGradeBand(...))`.
- Prompt now includes a new constraint:
  > Use vocabulary appropriate for `{{{gradeBandLabel}}}`. A Class 3 student
  > should NOT see Class 9 vocabulary in question text, options, correct
  > answers, or explanations. […] Re-read every question before finalising
  > and downgrade any word that exceeds the band.

### F11-3 — `onboardingPhase` client-writable bypass
- **File:** `src/app/actions/profile.ts`.
- Added `ONBOARDING_PHASE_PREREQUISITES` map:
  - `first-generation` / `exploring` / `completed` → require state,
    schoolName, subjects (non-empty), gradeLevels (non-empty).
  - `language-picked` has no prerequisites.
- New `hasValue()` predicate (handles arrays + trimmed strings).
- In `updateProfileAction`, after the allowlist filter, if the payload
  attempts to advance `onboardingPhase`:
  1. Load existing profile.
  2. Merge with the patch.
  3. Reject with a descriptive error if any prerequisite is still
     missing on the merged state. (This means a single PATCH that
     supplies both prerequisites and phase advance is accepted — the
     legitimate onboarding flow's pattern — but a phase-only patch on a
     blank profile is rejected.)
- Logs a `WARN` for rejected escalations so abuse attempts are visible.
- **Test:** `src/__tests__/actions/profile-onboarding-phase.test.ts` —
  6 cases including the explicit "no prerequisites, direct exploring write"
  rejection requested in the spec.

### F11-5 — `syncUserAction` displayName/photoURL clobber
- **File:** `src/app/actions/auth.ts`.
- Patch is now built from only truthy fields (matching the existing F11-4
  pattern for `email`):
  ```ts
  const profileData: Partial<UserProfile> = { uid: callerUid };
  if (user.email) profileData.email = user.email;
  if (user.displayName) profileData.displayName = user.displayName;
  if (user.photoURL) profileData.photoURL = user.photoURL;
  ```
- Phone-only re-sign-in (Firebase Phone Auth) leaves `displayName`/`photoURL`
  as `null`; writing `""` would clobber values the teacher set during
  onboarding (uploaded photo, chosen display name).
- **Test:** `src/__tests__/actions/sync-user-no-clobber.test.ts` — 3 cases
  covering null, empty string, and truthy provider values.

### F11-2 — Dual-allowlist drift
- **File:** `src/app/actions/profile.ts`.
- Reconciled `PROFILE_WRITABLE_FIELDS` (was 41 fields) with adapter-level
  `CLIENT_EDITABLE_USER_FIELDS` (51 fields). 10 fields permitted at adapter
  but silently stripped at action — all legitimate — added to action
  allowlist:
  - `lastLessonPlanLanguage`, `notificationPreferences`, `voicePreferences`
    (preferences)
  - `onboardingComplete` (onboarding flag)
  - `consentGivenAt`, `consentVersion` (privacy)
  - `avatarUrl`, `phone`, `teachingGradeLevels` (legacy aliases)
  - `groupsInitialized` (system flag with explicit "client may force-rerun"
    comment in adapter)
- All added fields were already in the adapter allowlist with security
  rationale; no privilege-escalation risk introduced.

### F11-6 — Onboarding Step 1 autosave
- **File:** `src/app/onboarding/page.tsx`.
- Added a debounced (800ms) per-section autosave effect for Step 1.
- Persists `schoolName` (+ `schoolNormalized`), `state`, `educationBoard`,
  `subjects`, `gradeLevels`, `administrativeRole` as the teacher fills them.
- Only fires once the teacher has interacted with at least one field
  (skips the initial-mount save).
- Does NOT write `onboardingPhase`; that still happens only on the explicit
  "Continue" submit. F11-3's prerequisite check thus also protects this
  autosave from accidentally allowing a phase escalation.
- On re-entry, the existing `getProfileData` effect repopulates these
  fields so the teacher resumes from where they left off.

## Tests

New:
- `src/__tests__/lib/grade-bands.test.ts` — 13 cases for band derivation,
  default question counts, display labels, and pedagogy block invariants.
- `src/__tests__/actions/profile-onboarding-phase.test.ts` — 6 cases for
  the F11-3 prerequisite gate.
- `src/__tests__/actions/sync-user-no-clobber.test.ts` — 3 cases for the
  F11-5 truthy-only patch.

Pre-existing kept green:
- `quiz-dispatch`, `lesson-plan-dispatch`, `lesson-plan-language-leak`,
  `adapter-allowlist`, `wave-1-auth` — all 64 cases pass.

## Verification

```
npm run typecheck                # passes, zero errors
npx jest src/__tests__/lib/grade-bands.test.ts \
         src/__tests__/actions/profile-onboarding-phase.test.ts \
         src/__tests__/actions/sync-user-no-clobber.test.ts
# 22 passed
npx jest src/__tests__/lib/quiz-dispatch.test.ts \
         src/__tests__/lib/lesson-plan-dispatch.test.ts \
         src/__tests__/ai/lesson-plan-language-leak.test.ts \
         src/__tests__/lib/adapter-allowlist.test.ts \
         src/__tests__/actions/wave-1-auth.test.ts
# 64 passed
```

## Files Touched

```
src/lib/grade-bands.ts                                   (new)
src/ai/schemas/quiz-generator-schemas.ts                 (gradeBandLabel field)
src/ai/flows/quiz-generator.ts                           (numQuestions + gradeBandLabel injection)
src/ai/flows/quiz-definitions.ts                         (vocab-age prompt section)
src/ai/flows/lesson-plan-generator.ts                    (pedagogy block injection + prompt template)
src/app/actions/profile.ts                               (allowlist reconciliation + phase prerequisite check)
src/app/actions/auth.ts                                  (truthy-only patch)
src/app/onboarding/page.tsx                              (Step 1 autosave)
src/__tests__/lib/grade-bands.test.ts                    (new)
src/__tests__/actions/profile-onboarding-phase.test.ts   (new)
src/__tests__/actions/sync-user-no-clobber.test.ts       (new)
qa/forensics/fixes/F18-F11-fix-report.md                 (new — this report)
```
