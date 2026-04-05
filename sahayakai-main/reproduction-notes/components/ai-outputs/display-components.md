# AI Output Display Components

All display components follow the same pattern: receive AI-generated data, render it in a print-ready layout, provide copy/save/PDF actions.

---

## InstantAnswerDisplay

**File:** `src/components/instant-answer-display.tsx`

**Props:** `{ result: InstantAnswerSchema, userId?: string }`

**Sections:**
- Answer text: markdown rendered via `react-markdown` with `@tailwindcss/typography` prose class
- Source links: Google Search grounding citations (if any)
- YouTube suggestions: video thumbnails with Watch buttons
- Action buttons: Copy (clipboard), Save to Library, PDF (print)
- FeedbackDialog: thumbs up/down

**Print ID:** `<div id="instant-answer-pdf">`

---

## LessonPlanDisplay

**File:** `src/components/lesson-plan-display.tsx`

**Props:** `{ plan: LessonPlanSchema, onSave?, editable? }`

**Sections:**
- Plan header: title, grade, subject, language, duration
- Accordion (5 sections — each collapsible):
  - Objectives (numbered list)
  - Materials (bulleted list)
  - Engage activity
  - Explore activity
  - Explain / Elaborate / Evaluate activities
  - Assessment
- Each section: editable on click (textarea replaces display text)
- Edit % tracker: badge showing "38% customized" etc.
- Actions: Copy, Save, PDF

**Print ID:** `<div id="lesson-plan-pdf">`
**Print CSS:** All accordion items forced open (`[data-state] { display: block !important }`)

---

## QuizDisplay

**File:** `src/components/quiz-display.tsx`

**Props:** `{ quiz: QuizSchema, onSave? }`

**Sections:**
- Tabs: Easy | Medium | Hard (Radix Tabs)
- Per-question card:
  - Question number badge
  - Question text (editable inline)
  - Options (MCQ: lettered A/B/C/D)
  - Answer highlighted when key shown
  - Regenerate button (RefreshCw icon) — replaces single question
- Add Question button
- Answer Key toggle
- Actions: Copy, Save, PDF, Text download

**Print ID:** `<div id="quiz-sheet">`

---

## RubricDisplay

**File:** `src/components/rubric-display.tsx`

**Props:** `{ rubric: RubricSchema, onSave? }`

**Structure:**
- HTML `<table>` layout
- Columns: Criterion | Exemplary | Proficient | Developing | Beginning
- Column headers: color-coded (green → yellow → orange → red progression)
- Row headers: criterion names (bold)
- Actions: Copy, Save, PDF

**Print ID:** `<div id="rubric-pdf">`

---

## WorksheetDisplay

**File:** `src/components/worksheet-display.tsx`

**Props:** `{ worksheet: WorksheetSchema, onSave? }`

**Structure:**
- Title
- Instructions (highlighted box if present)
- Content: markdown rendered + KaTeX for math expressions (`$E = mc^2$`)
- Actions: Copy, Save, PDF

**Print ID:** `<div id="worksheet-pdf">`

**KaTeX:** Inline math `$...$` and block math `$$...$$` are rendered to proper mathematical notation.

---

## VisualAidDisplay

**File:** `src/components/visual-aid-display.tsx`

**Props:** `{ visualAid: VisualAidSchema, onSave? }`

**Structure:**
- Generated image (full-width, rounded-2xl, aspect-ratio maintained)
- Alt text (screen reader, also shown as caption)
- Pedagogical context: collapsible section
- Discussion spark: orange-accent callout box
- Actions: Save, PDF

**Print ID:** `<div id="visual-aid-pdf">`

---

## VirtualFieldTripDisplay

**File:** `src/components/virtual-field-trip-display.tsx`

**Props:** `{ trip: VFTSchema, onSave? }`

**Structure:**
- Trip title + overall theme
- Stop cards (numbered, e.g., "Stop 1 of 5"):
  - Stop name
  - "Open in Google Earth" button → `globe2` icon, opens URL in new tab
  - Description paragraph
  - Cultural analogy (italicized)
  - Educational facts (bulleted list)
  - Reflection prompt (highlighted box)
- Actions: Save, PDF

**Print ID:** `<div id="field-trip-pdf">`

---

## TeacherTrainingDisplay

**File:** `src/components/teacher-training-display.tsx`

**Props:** `{ training: TeacherTrainingSchema, onSave? }`

**Structure:**
- Strategy cards (each with icon, title, description)
- Actionable steps list (numbered)
- Pedagogy note (callout box, italic)
- Actions: Copy, Save, PDF

**Print ID:** `<div id="training-pdf">`

---

## Common Action Pattern (all display components)

```
Copy button:    navigator.clipboard.writeText(formattedText)
Save button:    saveToLibrary(userId, { type, title, data }) → toast on success
PDF button:     window.print() — CSS handles showing only the target div
FeedbackDialog: thumbs up/down → submitFeedback() action
```
