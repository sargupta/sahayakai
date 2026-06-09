# Lesson Plan - /lesson-plan

**File:** `src/app/lesson-plan/page.tsx`
**Auth:** Required (page GET passes through; generation requires a valid Bearer token)
**Snapshot:** 2026-06-10

---

## Purpose

Generate structured 5E lesson plans (Engage, Explore, Explain, Elaborate, Evaluate) with NCERT chapter alignment, resource-level and difficulty tuning, and an offline fallback path.

---

## Architecture Note

The page is a thin wrapper. It renders `<LessonPlanView />` wrapped in `<Suspense>` (fallback `LessonPlanFormSkeleton`). All logic lives in the `useLessonPlan` hook.

- Page: `src/app/lesson-plan/page.tsx`
- View: `src/features/lesson-planner/components/lesson-plan-view.tsx`
- Hook: `src/features/lesson-planner/hooks/use-lesson-plan.ts`
- Types/schema: `src/features/lesson-planner/types.ts`

(The feature was moved from `src/components/lesson-plan/*` into `src/features/lesson-planner/*`.)

---

## State (via `useLessonPlan` hook)

Form is `react-hook-form` + `zodResolver(formSchema)`. Key fields/state:

| State | Purpose |
|---|---|
| `form` (`FormValues`) | `topic`, `language` (ISO, defaults to user app language via `LANGUAGE_TO_ISO`), `gradeLevels[]`, `subject`, `imageDataUri` |
| `lessonPlan` (`LessonPlanOutput \| null`) | Generated plan |
| `isLoading` / `loadingMessage` | Generation in flight + rotating status text |
| `limitState` (via `useLimitGuard`) | Plan-limit / quota gate state |
| `selectedChapter` (`NCERTChapter \| null`) | Optional NCERT chapter context |
| `resourceLevel` (`'low'\|'medium'\|'high'`, default `low`) | Classroom resource tuning |
| `difficultyLevel` (`'remedial'\|'standard'\|'advanced'`, default `standard`) | Difficulty tuning |
| `isOffline` | Toggles offline pre-written-plan path |

Drafts are auto-saved to IndexedDB (`saveDraft("lessonPlanDraft")`). Telemetry events are queued offline and synced via `syncTelemetryEvents`.

---

## Data Flow

1. User fills form, submits. `requireAuth()` gates; opens auth modal if signed out.
2. Cloud cache is checked first via `getCachedLessonPlan` server action (`cached_lesson_plans`).
3. If `isOffline`, a pre-written plan from `offlineLessonPlans[chapter.id]` is loaded (or a toast prompts reconnect).
4. Otherwise `POST /api/ai/lesson-plan` with Bearer token. Body includes `topic`, `language` (always non-empty; defaults to `en`), `gradeLevels`, `imageDataUri`, `useRuralContext:true`, `resourceLevel`, `difficultyLevel`, `subject` (the `General` placeholder is stripped to `undefined`), and optional `ncertChapter`.
5. On success the result renders and is cached via `saveLessonPlanToCache`.

---

## API + AI Integration

- **Route:** `src/app/api/ai/lesson-plan/route.ts` (`maxDuration = 120`). Wrapped in `withPlanCheck` (plan-guard) and requires `x-user-id` (injected by middleware).
- **Dispatch:** `dispatchLessonPlan` (`src/lib/sidecar/lesson-plan-dispatch.ts`) routes to the Genkit flow or the ADK-Python sidecar based on the Firestore `lessonPlanSidecarMode`/`lessonPlanSidecarPercent` flags. Default `off` = pure Genkit.
- **Flow:** `src/ai/flows/lesson-plan-generator.ts`
- **Model:** `googleai/gemini-2.5-flash`
- **Grounding:** REMOVED (saved ~$0.035/call; static lesson content does not need live search)
- **Structure:** 5E model with Indian-context prompting
- **Streaming variant:** `/api/ai/lesson-plan/stream` exists for incremental output.

---

## Voice Features

- Voice/topic mic input on the topic field (voice to topic auto-fill).

---

## NCERT Integration

`NCERTChapterSelector`:
- Fetches chapters (server action) with local `@/data/ncert` fallback.
- When a chapter is selected, its title, number, and learning outcomes are injected into the request body.

---

## Offline

- `offlineLessonPlans` (`@/data/offline-lesson-plans`) provides pre-written plans keyed by NCERT chapter id for the offline path.
