# Quiz Generator — /quiz-generator

**File:** `src/app/quiz-generator/page.tsx`
**Auth:** Required

---

## Purpose

Generate quizzes with automatic difficulty variants (easy/medium/hard) using Bloom's Taxonomy levels. Teachers can customize question types and count, then edit individual questions.

---

## Component Tree

```
QuizGeneratorPage
├── Header (title + description)
├── Form section
│   ├── LanguageSelector
│   ├── GradeLevelSelector
│   ├── SubjectSelector
│   ├── Topic input + MicrophoneInput
│   ├── Question type checkboxes (MCQ, True/False, Fill-in-blank, Short Answer)
│   ├── Bloom's taxonomy level checkboxes (Remember, Understand, Apply, Analyze, Evaluate, Create)
│   ├── Question count selector (5, 10, 15, 20)
│   └── Generate button
└── QuizDisplay (when result available)
    ├── Tabs: Easy | Medium | Hard
    ├── Per-question: text, options, answer key toggle
    ├── Edit question button (inline edit)
    ├── Add question button
    ├── Regenerate single question button
    ├── Answer key toggle (show/hide)
    ├── Copy / Save / PDF / Text export buttons
    └── FeedbackDialog
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `topic` | `string` | Quiz topic |
| `gradeLevel` | `GradeLevel` | Target grade |
| `subject` | `Subject` | Subject |
| `language` | `Language` | Output language |
| `questionTypes` | `string[]` | Selected types (MCQ etc.) |
| `bloomsLevels` | `string[]` | Selected Bloom's levels |
| `questionCount` | `number` | Questions per difficulty |
| `result` | `QuizSchema \| null` | Generated quiz |
| `loading` | `boolean` | Generation in flight |
| `showAnswerKey` | `boolean` | Toggle answer visibility |
| `activeTab` | `'easy' \| 'medium' \| 'hard'` | Current difficulty tab |

---

## AI Integration

- **Flow:** `src/ai/flows/quiz-generator.ts`
- **Model:** Gemini via Genkit
- **Key feature:** Generates all 3 difficulty levels **in parallel** (3 concurrent Gemini calls) for speed
- **Bloom's Taxonomy:** Question complexity maps to selected cognitive levels
- **Output structure:** `{ easy: QuizQuestion[], medium: QuizQuestion[], hard: QuizQuestion[] }`
- **QuizQuestion:** `{ id, question, options?, answer, type, bloomsLevel, explanation? }`

---

## QuizDisplay Features

- **Difficulty tabs** — Easy/Medium/Hard (Radix Tabs)
- **Inline edit** — click question text to edit in place
- **Per-question regeneration** — regenerate just one question without redoing entire quiz
- **Add question** — append new AI-generated question to current tab
- **Answer key toggle** — teacher can print quiz without answers for students

---

## Export Options

1. **PDF** — browser print with `#quiz-sheet` print ID
2. **Copy** — copies formatted text to clipboard
3. **Text file** — downloads as `.txt`
4. **Save to Library** — saves to `users/{uid}/content` as type `quiz`

---

## Voice Features

- `MicrophoneInput` on topic field

---

## Design

- Form: two-column layout for checkboxes (question types + Bloom's levels)
- Quiz display: tab-based with question cards
- Each question card: number badge, question text, options (if MCQ), answer highlighted in green when key shown
- Regenerate icon button on each question: `RefreshCw` Lucide icon
