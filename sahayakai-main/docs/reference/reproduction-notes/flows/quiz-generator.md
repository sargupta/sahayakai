# AI Flow: Quiz Generator

> Refreshed 2026-06-10 against current source.

**Files:**
- `src/ai/flows/quiz-generator.ts` - orchestrator (`generateQuiz`)
- `src/ai/flows/quiz-definitions.ts` - `quizGeneratorFlow` + prompt definition
- `src/ai/flows/quiz-definitions-enhanced-validation.ts` - additional validation
- `src/ai/schemas/quiz-generator-schemas.ts` - input/output Zod types

**API Route:** `POST /api/ai/quiz` (plus public health probe `GET /api/ai/quiz/health`).
**Model:** `googleai/gemini-2.5-flash` (default Genkit model; `quizGenerator.prompt`).

---

## Purpose

Generate a quiz at 3 difficulty levels (easy / medium / hard) in parallel for one topic. Grade-band aware for question count and vocabulary age.

---

## Input (`QuizGeneratorInput`)

Key fields used by `generateQuiz`: `topic`, `gradeLevel`, `subject`, `language`, `numQuestions`, `userId`, `teacherContext`, `gradeBandLabel`. Per-variant the orchestrator sets `targetDifficulty: 'easy' | 'medium' | 'hard'`.

Pre-processing in `generateQuiz`:
- F18-01 grade-aware default `numQuestions` (`defaultNumQuestionsForGrade`): Primary(1-5)=5, Middle(6-8)=10, Secondary(9-10)=15, Senior(11-12)=20. The caller's explicit value wins.
- F18-03 `gradeBandLabel` derived via `getGradeBand` / `getBandDisplayLabel` to bound vocabulary age.
- Language fallback from profile `preferredLanguage`; then `normalizeLanguage()` ("en" → "English").
- Soft NCERT chapter validation (`validateChapterForFlow`), non-blocking, with high-confidence topic auto-correct.

---

## Parallel Generation

```ts
const difficulties = ['easy','medium','hard'] as const;
const results = await Promise.allSettled(
  difficulties.map(d => quizGeneratorFlow({ ...localizedInput, targetDifficulty: d }))
);
```

`Promise.allSettled` - per-variant failure is WARN, not fatal: if even one variant succeeds the user gets a usable quiz. If ALL three fail and any failure looks like a quota error (`looksLikeQuota` checks `name === 'AIQuotaExhaustedError'` first to survive minification, then string signals 429 / quota / RESOURCE_EXHAUSTED / "temporarily overloaded"), it re-throws `AIQuotaExhaustedError` so the route returns 503 + Retry-After; otherwise a generic Error.

---

## Output (`QuizVariantsOutput`)

```ts
{
  easy: QuizSingleOutput | null;
  medium: QuizSingleOutput | null;
  hard: QuizSingleOutput | null;
  id: string;
  gradeLevel: string;
  subject: string;
  topic: string;
  isSaved: boolean;
  validationWarning?: ValidationWarning;
}
```

Metadata (`gradeLevel`, `subject`) is inferred from the first successful variant (prefer medium). When `userId` is present the result is saved: GCS `users/{uid}/quizzes/{ts}-{contentId}.json` + `dbAdapter.saveContent` with `type: 'quiz'`.

TODO(verify: exact per-question shape and the `quiz-definitions.ts` prompt details - defined in `quiz-definitions.ts` / `quiz-generator-schemas.ts`, not re-read here; confirm field names such as `bloomsLevel`/`explanation` before relying on them).
