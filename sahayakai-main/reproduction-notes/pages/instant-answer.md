# Instant Answer — /instant-answer

**File:** `src/app/instant-answer/page.tsx`
**Auth:** Required (prompts sign-in modal if unauthenticated)

---

## Purpose

Ask any teaching question and get an AI-powered answer with live web grounding (Google Search). Designed for quick classroom doubts, lesson explanations, and fact-checking.

---

## Component Tree

```
InstantAnswerPage
├── Header section (title, description)
├── LanguageSelector
├── GradeLevelSelector
├── Question input + MicrophoneInput button
├── Submit button ("Get Answer")
├── Loading state (skeleton / spinner)
└── InstantAnswerDisplay (when result available)
    ├── Answer text (markdown rendered)
    ├── Source links (from Google Search grounding)
    ├── YouTube video suggestions
    ├── Copy / Save / PDF buttons
    └── FeedbackDialog (thumbs up/down)
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `question` | `string` | Input text |
| `language` | `Language` | Selected output language |
| `gradeLevel` | `GradeLevel` | Target grade |
| `result` | `object \| null` | AI response |
| `loading` | `boolean` | Request in flight |
| `error` | `string \| null` | Error message |

---

## Data Flow

1. User types or speaks question (MicrophoneInput fills the input)
2. Submit → `POST /api/ai/instant-answer` with `{ question, language, gradeLevel }`
3. API route calls `instantAnswer()` flow → Gemini with Google Search grounding
4. Response rendered in `InstantAnswerDisplay`
5. Optional: Save to library → `saveToLibrary()` action

---

## AI Integration

- **Flow:** `src/ai/flows/instant-answer.ts`
- **Model:** Gemini (via Genkit)
- **Grounding:** Google Search enabled (unlike lesson plan — this one needs live facts)
- **Input normalization:** language name → full name, grade → "Class X" format
- **Output:** Markdown text + source citations
- **Persistence:** Auto-saves to Firestore when userId present

---

## Voice Features

- `MicrophoneInput` — mic icon in question input
- On transcript received: fills `question` state, auto-submits
- Language selector affects speech recognition lang hint

---

## Error States

- API error: inline error message below input
- Empty question: button disabled
- Rate limit: toast "Too many requests"

---

## Loading State

- Submit button shows `Loader2` spinner and "Getting answer…"
- Result area shows skeleton cards

---

## Design

- Single-column layout
- Question input: `min-h-[80px]` Textarea (resizable) with Mic icon button
- Result card: white, rounded-2xl, shadow-sm, with markdown prose styling
- Source links: small badges with external link icon

---

## Key Business Logic

- Google Search grounding is intentionally kept on this flow (unlike lesson-plan which had it removed)
- Rationale: teachers ask time-sensitive questions (current events, exam updates)
- Saves to `users/{uid}/content` as type `instant-answer`
