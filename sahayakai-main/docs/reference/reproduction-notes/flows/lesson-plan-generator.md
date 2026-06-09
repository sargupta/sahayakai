# AI Flow: Lesson Plan Generator

> Refreshed 2026-06-10 against current source.

**File:** `src/ai/flows/lesson-plan-generator.ts`
**API Route:** `POST /api/ai/lesson-plan` (and `/api/ai/lesson-plan/stream` for streaming).
**Model:** `googleai/gemini-2.5-flash` - main generation via `lessonPlanPrompt` (default Genkit model; usage tracked as `gemini-2.5-flash` at `:500`, `:509`). The materials-audit sub-call sets the model explicitly: `model: 'googleai/gemini-2.5-flash'` (`:130`). NO Google Search grounding (removed to save cost).

---

## Purpose

Generate structured lesson plans. Activities follow the 5E model, but the framework is grade-band-aware: a `pedagogyFrameworkBlock` derived from `gradeLevels[0]` switches between Primary (story/play), Middle (5E), Secondary (board-exam prep), and Senior (deep analysis + competitive-exam strategy) instead of hard-applying 5E to every band (F18-02).

---

## Input Schema (`LessonPlanInputSchema`)

```ts
{
  topic: string;
  language?: string;
  gradeLevels?: string[];
  imageDataUri?: string;          // optional textbook page (data URI) - multimodal
  userId: string;                 // REQUIRED - middleware injects x-user-id
  teacherContext?: string;        // career-stage personalisation line
  useRuralContext?: boolean;      // default true
  ncertChapter?: { title, number, subject?, learningOutcomes[] };
  resourceLevel?: 'low' | 'medium' | 'high';      // default low
  difficultyLevel?: 'remedial' | 'standard' | 'advanced';  // default standard
  subject?: string;
  // Server-populated hyperlocal context (never user-supplied):
  state?: string; district?: string; schoolType?: string; teacherMotherTongue?: string;
  regionalContextBlock?: string;  // pre-rendered local crops/festivals/geography
  pedagogyFrameworkBlock?: string;  // F18-02, derived from gradeLevels[0]
  gradeBandLabel?: string;
}
```

The exported `generateLessonPlan()` wrapper: `validateTopicSafety(topic)`; grade override via `extractGradeFromTopic`; `checkServerRateLimit(uid)`; pulls one profile snapshot for language/state/district/subject fallbacks (strict language fallback - only fires when `language` is undefined/null, NOT empty string, per the NCERT-demo 2026-05-19 language-leak fix); renders `regionalContextBlock`; derives the grade-band pedagogy block/label.

---

## Output Schema (`LessonPlanOutputSchema`)

```ts
{
  title: string;
  gradeLevel?: string | null;
  duration?: string | null;
  subject?: string | null;
  objectives: string[];
  keyVocabulary?: { term, meaning }[] | null;
  materials: string[];
  activities: {
    phase: 'Engage' | 'Explore' | 'Explain' | 'Elaborate' | 'Evaluate';
    name: string; description: string; duration: string;
    teacherTips?: string | null; understandingCheck?: string | null;
  }[];
  assessment?: string | null;
  homework?: string | null;
  language?: string;
  validationWarning?: {            // soft NCERT chapter warning; generation still proceeds
    invalid: boolean; lenient: boolean; message: string;
    autoCorrectTo?: { number, title };
  } | null;
}
```

---

## Processing Steps (`lessonPlanFlow`)

1. Wrapped in `Sentry.withServerActionInstrumentation`; `normalizeInput()` for language/grade.
2. Soft NCERT chapter validation via `validateChapterForFlow` - never throws, never blocks. High-confidence mismatches auto-correct `topic` to the canonical chapter title; the warning is surfaced on the response.
3. Cache lookup (skipped when `imageDataUri` present): `generateLessonPlanCacheKey` → `getCachedLessonPlan`. Cache hits still persist to the user's library.
4. AI generation via `runResiliently('lessonPlan.generate')` calling `lessonPlanPrompt` (output format `'json'`).
5. Explicit `LessonPlanOutputSchema.parse(output)`.
6. Materials audit: a second `gemini-2.5-flash` call (`auditMaterials`, temperature 0.2, `responseMimeType: 'application/json'`) finds objects mentioned in activities but missing from `materials` and merges them. Failures are non-blocking.
7. `setCachedLessonPlan` on success.
8. Persistence (non-blocking): GCS `users/{uid}/lesson-plans/{ts}_{safeTitle}.json` + `dbAdapter.saveContent` with `type: 'lesson-plan'`.

---

## Prompt Structure

`SAHAYAK_SOUL_PROMPT + STRUCTURED_OUTPUT_OVERRIDE` plus: exact grade-level priority; the `pedagogyFrameworkBlock` (or a fallback 5E block); hard Language Lock on every field; resource-constraint guidance keyed off `resourceLevel`; the `regionalContextBlock` (or a fallback pan-India context block with rupees and Indian examples); locality reference when `state` present; NCERT alignment when `ncertChapter` present; multimodal `{{media url=imageDataUri}}` when an image is provided. Ends "Respond ONLY with valid JSON following the schema."

---

## Cost Optimization

Google Search grounding was removed from this flow (lesson content does not need live web data). The only extra LLM cost is the lightweight materials-audit call.
