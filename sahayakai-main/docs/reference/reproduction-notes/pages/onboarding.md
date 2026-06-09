# Onboarding Page - /onboarding

**File:** `src/app/onboarding/page.tsx`
**Auth:** Required (`onAuthStateChanged`; signed-out users are `router.push("/")`)
**Snapshot:** 2026-06-10

---

## Purpose

First-time setup for new teachers, ending in an AI "aha moment" (a real lesson plan generated from their own inputs). Collects role, school, state, board, subjects, grades, and preferred language so AI tool outputs and the community feed are personalized.

---

## Flow (3 steps, NOT the old 4-step wizard)

The wizard is driven by a single `step` state (`0 | 1 | 2`):

- **Step 0 - Language Picker.** Choose `preferredLanguage`. Saves immediately via `saveStep({ preferredLanguage })`, then `setStep(1)`. Smart default: if `navigator.language` maps to an Indic locale (`LANGUAGE_CODE_MAP`), that language is pre-selected.
- **Step 1 - Single-screen setup.** All profile fields on one screen (mobile uses an accordion via `activeSection`): administrative role, display name, school name, state, education board (+ `boardCategory`), subjects (multi), grades (multi), optional phone/pincode. Per-section autosave (F11-6) persists partial progress; "Continue" → `handleStep1Submit()` → `updateProfileAction` → `setStep(2)`.
- **Step 2 - Hybrid Aha Moment.** Teacher picks a topic and generates a real lesson plan; finishing saves it to their library and routes by role.

---

## State (selected)

| State | Type | Purpose |
|---|---|---|
| `step` | `0 \| 1 \| 2` | Current step (language / setup / aha) |
| `formData` | object | Accumulated profile fields (see Step 1 list above) |
| `loading` | `boolean` | Initial profile load |
| `submitting` | `boolean` | Save/submit in flight |
| `userId` | `string \| null` | Resolved auth uid |
| `activeSection` | `number` | Mobile Step 1 accordion section |
| `selectedTopic` | `string` | Topic for the Step 2 generation |
| `generating` / `generatedContent` / `generationError` | - | Step 2 AI generation state |
| `previewExample` | `OnboardingExample \| null` | Sample preview helper |

`isStep1Valid` requires: role set, displayName >= 2 chars, schoolName, state, educationBoard, >=1 subject, >=1 grade, and no phone/pincode errors.

---

## Data Flow

1. Mount (`onAuthStateChanged`): resolve uid, `getProfileData(uid)`.
   - If `profile.schoolName` already exists (already onboarded): best-effort `POST /api/profile/mark-complete` (mints the profile-complete cookie to avoid the `/` ⇆ `/onboarding` loop), then `router.push("/")`.
   - Otherwise pre-fill `formData` from the existing profile; if `preferredLanguage` is already set, jump to `setStep(1)`.
2. Step 0 finish: `saveStep({ preferredLanguage })`.
3. Step 1 finish: `updateProfileAction(uid, profileData)` (server computes `profileCompletionLevel`).
4. Step 2 generate: `POST /api/ai/lesson-plan` with the teacher's topic + first grade/subject + `preferredLanguage`.
5. Finish (`handleFinish`): `saveStep({ onboardingPhase: 'completed', ... })`; if content was generated, `saveToLibrary(uid, 'lesson-plan', ...)` and record `firstGenerationContentId`/`firstGenerationTool`; `POST /api/profile/mark-complete`; route by role.

---

## Routing on Finish

- Principal / vice-principal (`administrativeRole`) → `router.push("/organization/dashboard")`
- Everyone else → `router.push("/")`

---

## Lockout Note (2026-06-08)

The onboarding gate caused a full-userbase lockout because the already-onboarded redirect fired before any `mark-complete` call, so no cookie was minted and `/` bounced straight back to `/onboarding`. The code now mints the cookie before redirecting. Per project memory the onboarding gate flag (`ONBOARDING_GATE_ENABLED`) remains OFF in production.

---

## Design

- Centered `Card`, `max-w-lg sm:max-w-2xl`, `rounded-2xl`, `shadow-soft`.
- Step 0 language grid; Step 1 single-screen (mobile accordion); Step 2 generation + preview.
- Saffron (`primary`) for active elements and CTAs; Lucide icons only.
