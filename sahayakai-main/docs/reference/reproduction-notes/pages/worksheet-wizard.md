# Worksheet Wizard - /worksheet-wizard

**File:** `src/app/worksheet-wizard/page.tsx`
**Auth:** Required
**Snapshot:** 2026-06-10

---

## Purpose

Generate printable student worksheets. Supports image upload so teachers can generate worksheets based on a diagram or textbook image. Outputs markdown with LaTeX math support.

---

## Component Tree

```
WorksheetWizardPage
├── Header (title + description)
├── Form
│   ├── LanguageSelector
│   ├── GradeLevelSelector
│   ├── SubjectSelector
│   ├── Topic input + MicrophoneInput
│   ├── ImageUploader (optional - attach textbook diagram)
│   └── Generate button
└── WorksheetDisplay (when result available)
    ├── Title
    ├── Markdown content (with KaTeX math rendering)
    ├── Copy / Save / PDF buttons
    └── FeedbackDialog
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `topic` | `string` | Worksheet topic |
| `gradeLevel` | `GradeLevel` | Target grade |
| `subject` | `Subject` | Subject |
| `language` | `Language` | Output language |
| `imageUrl` | `string \| null` | Uploaded image URL (optional) |
| `result` | `WorksheetSchema \| null` | Generated worksheet |
| `loading` | `boolean` | In flight |

---

## API + AI Integration

- **Route:** `POST /api/ai/worksheet` (wrapped in `withPlanCheck('worksheet')`).
- **Dispatch:** `dispatchWorksheet` (`src/lib/sidecar/worksheet-dispatch.ts`); Firestore `worksheetSidecarMode` selects Genkit vs ADK sidecar (default `off`).
- **Flow:** `src/ai/flows/worksheet-wizard.ts` (validation companion `worksheet-validation.ts`).
- **Model:** `googleai/gemini-2.5-flash` (multimodal; accepts an image input).
- **Math support:** activities may include LaTeX math expressions.
- **Output schema (`WorksheetWizardOutputSchema`):** `{ title, gradeLevel, subject, learningObjectives[], studentInstructions, activities: [{ content, explanation }], answerKey: [{ activityIndex, answer }] }`. A markdown `worksheetContent` is also assembled server-side for display/print.

---

## Image Upload

- `ImageUploader` component - drag-drop or click to upload
- Max size: 4MB, formats: JPEG/PNG/WEBP
- Uploads to Firebase Storage → returns URL
- URL passed to AI flow as multimodal image input

---

## WorksheetDisplay

- Renders markdown with `remark`/`rehype` pipeline
- KaTeX integration for math expressions
- Print-friendly layout: `<div id="worksheet-pdf">`
- Instructions shown in a highlighted box above content

---

## Design

- Image upload area: dashed border, drag-drop zone with Upload icon
- Preview of uploaded image shown below upload area
- Generated worksheet: clean print-like layout with serif fonts for content
