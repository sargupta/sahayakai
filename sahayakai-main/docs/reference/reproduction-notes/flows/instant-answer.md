# AI Flow: Instant Answer

> Refreshed 2026-06-10 against current source.

**File:** `src/ai/flows/instant-answer.ts`
**API Route:** `POST /api/ai/instant-answer`
**Model:** `googleai/gemini-2.5-flash` (default Genkit model; usage tracked as `gemini-2.5-flash` at `:182`, `:211`).

---

## Purpose

Answer any teaching question with web-grounded information. This is the one flow that intentionally keeps Google Search grounding (the prompt declares `tools: [googleSearch]` from `@/ai/tools/google-search`). Teachers ask about current events, syllabus updates, and recent facts.

---

## Input Schema (`InstantAnswerInputSchema`)

```ts
{
  question: string;
  language?: string;        // e.g. "English", "Hindi"
  gradeLevel?: string;
  subject?: string;
  userId: string;           // REQUIRED at schema level - middleware always injects x-user-id
}
```

The exported `instantAnswer()` wrapper enforces: question <= 4000 chars; `validateTopicSafety(question)`; non-empty `userId` (throws "Unauthorized" otherwise); `checkServerRateLimit(uid)`. If `language`/`gradeLevel` are absent it pulls `preferredLanguage` / `teachingGradeLevels[0]` from the user profile via `dbAdapter.getUser(uid)`.

---

## Output Schema (`InstantAnswerOutputSchema`)

```ts
{
  answer: string;                         // Markdown
  videoSuggestionUrl?: string | null;     // a YouTube SEARCH URL, never a guessed video ID
  gradeLevel?: string | null;
  subject?: string | null;
}
```

Note: the prompt instructs the model to return a YouTube results SEARCH URL (`https://www.youtube.com/results?search_query=...`), not a specific `watch?v=` ID (which could be fabricated).

---

## Processing Steps (`instantAnswerFlow`)

1. `normalizeInput()` - language name normalization via `LANGUAGE_CODE_MAP`; grade coerced to "Class N" / Nursery / LKG / UKG.
2. Run `instantAnswerPrompt` inside `runResiliently('instantAnswer.generate')` (key-pool failover + backoff from `genkit.ts`).
3. Track usage: `UsageTracker.trackGemini(...)` plus `UsageTracker.trackGrounding(...)` (this prompt carries the `googleSearch` tool, counted as a grounding call).
4. Graceful schema-mismatch recovery: if Genkit throws `INVALID_ARGUMENT` / "Schema validation failed" (model returned wrong field name such as `response` instead of `answer`), return a polite educational-only refusal in `answer`.
5. Explicit final `InstantAnswerOutputSchema.parse(output)` safety net (throws `SchemaValidationError`).
6. Persistence (non-blocking): writes the JSON to GCS `users/{uid}/instant-answers/{ts}_{safeTitle}.json` and saves a content doc via `dbAdapter.saveContent` with `type: 'instant-answer'`. Failures log WARN; the user still receives the answer.

---

## Prompt Structure

Composed from `SAHAYAK_SOUL_PROMPT + STRUCTURED_OUTPUT_OVERRIDE` (`@/ai/soul`) plus instructions: use `googleSearch` for current facts; tailor complexity to `gradeLevel`; hard Language Lock to `{{{language}}}`; no-repetition-loop guard; schema-compliance rule (answer MUST be in the `answer` field).

---

## Why Grounding Stays Here

Unlike the lesson-plan flow (where Google Search grounding was removed to cut cost), Instant Answer legitimately needs live facts: syllabus updates, current events, recent discoveries.
