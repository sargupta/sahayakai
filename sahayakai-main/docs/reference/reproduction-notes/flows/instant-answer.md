# AI Flow: Instant Answer

**File:** `src/ai/flows/instant-answer.ts`
**API Route:** `POST /api/ai/instant-answer`

---

## Purpose

Answer any teaching question with real-time web-grounded information. The only flow that intentionally uses Google Search grounding (teachers ask about current events, syllabus updates, etc.).

---

## Input Schema

```ts
{
  question: string;
  language: Language;
  gradeLevel: GradeLevel;
  userId?: string;             // for persistence
}
```

---

## Processing Steps

1. Normalize inputs: language name → full form, grade → "Class X" format
2. Build system prompt with Indian context (`getIndianContextPrompt()`)
3. Call Gemini with **Google Search grounding enabled**
4. Parse response + extract source citations
5. If `userId` provided: save to Firestore `users/{uid}/content` as `instant-answer` type

---

## Output Schema

```ts
{
  answer: string;              // Markdown formatted
  sources?: { title: string, url: string }[];
  suggestedVideos?: { title: string, videoId: string }[];
}
```

---

## Model Config

- Model: `gemini-1.5-flash` or `gemini-2.0-flash` (configured via Genkit)
- Google Search grounding: **enabled** (unique to this flow)
- Temperature: low (factual answers)
- Max tokens: 1024

---

## Key Decision: Why Grounding is Kept Here

Unlike lesson-plan (where grounding was removed to save $0.035/call), instant-answer legitimately needs live facts:
- Syllabus updates from NCERT/boards
- Current events for Social Studies
- Recent scientific discoveries

---

## Indian Context Injection

`getIndianContextPrompt(isRural)` appends context like:
- Use Indian examples (farmer, rupees, Ganga river)
- Reference Indian curriculum standards
- Avoid Western-centric analogies
