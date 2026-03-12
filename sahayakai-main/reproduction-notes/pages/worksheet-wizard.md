# Worksheet Wizard — /worksheet-wizard

**File:** `src/app/worksheet-wizard/page.tsx`
**Auth:** Required

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
│   ├── ImageUploader (optional — attach textbook diagram)
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

## AI Integration

- **Flow:** `src/ai/flows/worksheet-wizard.ts`
- **Model:** Gemini (multimodal — accepts image input)
- **Image input:** If imageUrl provided, Gemini analyzes the image and generates worksheet based on its content
- **Math support:** Output can include LaTeX math expressions (e.g., `$E = mc^2$`)
- **Output:** `{ title: string, content: string (markdown), instructions?: string }`

---

## Image Upload

- `ImageUploader` component — drag-drop or click to upload
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
