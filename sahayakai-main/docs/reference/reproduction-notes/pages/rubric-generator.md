# Rubric Generator — /rubric-generator

**File:** `src/app/rubric-generator/page.tsx`
**Auth:** Required

---

## Purpose

Generate assessment rubrics with 4 performance levels (Exemplary, Proficient, Developing, Beginning) for any assignment or task. Helps teachers communicate grading expectations clearly.

---

## Component Tree

```
RubricGeneratorPage
├── Header (title + description)
├── Explainer dialog (on first visit — explains what a rubric is)
├── Form
│   ├── LanguageSelector
│   ├── GradeLevelSelector
│   ├── SubjectSelector
│   ├── Assignment/task description input + MicrophoneInput
│   ├── Criteria count selector (3, 4, 5, 6 criteria)
│   └── Generate button
└── RubricDisplay (when result available)
    ├── Rubric as grid table
    │   ├── Rows: each criterion
    │   └── Columns: Exemplary | Proficient | Developing | Beginning
    ├── Copy / Save / PDF buttons
    └── FeedbackDialog
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `task` | `string` | Assignment description |
| `gradeLevel` | `GradeLevel` | Target grade |
| `subject` | `Subject` | Subject |
| `language` | `Language` | Output language |
| `criteriaCount` | `number` | How many criteria (3–6) |
| `result` | `RubricSchema \| null` | Generated rubric |
| `loading` | `boolean` | In flight |

---

## AI Integration

- **Flow:** `src/ai/flows/rubric-generator.ts`
- **Model:** Gemini via Genkit
- **Structure:** 4 levels × N criteria grid
- **Level labels:** Exemplary / Proficient / Developing / Beginning (language-translated)
- **Output:** `{ title, criteria: [{ name, levels: { exemplary, proficient, developing, beginning } }] }`

---

## RubricDisplay

- Rendered as HTML table with sticky header row
- Column headers: performance levels (color-coded: green → yellow → orange → red)
- Row headers: criterion names (bold)
- Each cell: descriptor text
- Print layout: `<div id="rubric-pdf">`, full table visible

---

## Explainer Dialog

A one-time dialog explaining what a rubric is and why to use it. Shown on first visit, dismissed with "Got it" button. State persisted in localStorage.

---

## Design

- Table uses alternating row shading for readability
- Level columns have color-coded top borders (green = Exemplary, red = Beginning)
- Print: full-page landscape orientation recommended in print CSS
