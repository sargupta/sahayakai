# Lesson Plan — /lesson-plan

**File:** `src/app/lesson-plan/page.tsx`
**Auth:** Required

---

## Purpose

Generate structured lesson plans following the 5E instructional model (Engage, Explore, Explain, Elaborate, Evaluate). Supports NCERT chapter alignment.

---

## Architecture Note

This page is a thin wrapper. All heavy logic lives in a custom hook `useLessonPlan`. The page simply renders the hook's state.

---

## Component Tree

```
LessonPlanPage
├── LessonPlanHeader (title + description)
├── LessonPlanInputSection
│   ├── LanguageSelector
│   ├── GradeLevelSelector
│   ├── SubjectSelector
│   ├── Topic input + MicrophoneInput
│   ├── Duration selector (30min, 45min, 60min)
│   ├── NCERTChapterSelector (optional)
│   └── Generate button
├── LessonPlanSidebar (tips, examples, history)
└── LessonPlanDisplay (when result available)
    ├── Editable accordion sections (objectives, materials, 5E activities, assessment)
    ├── Edit percentage tracker
    ├── Copy / Save to Library / PDF export buttons
    └── FeedbackDialog
```

---

## State (via `useLessonPlan` hook)

| State | Type | Purpose |
|---|---|---|
| `topic` | `string` | Lesson topic |
| `gradeLevel` | `GradeLevel` | Target grade |
| `subject` | `Subject` | Teaching subject |
| `language` | `Language` | Output language |
| `duration` | `string` | Lesson duration |
| `ncertChapter` | `object \| null` | Optional chapter reference |
| `result` | `LessonPlanSchema \| null` | Generated plan |
| `loading` | `boolean` | Generation in flight |
| `editedPlan` | `object` | User edits to the plan |
| `editPercentage` | `number` | % of content user has edited |

---

## Data Flow

1. User fills form → submits → `POST /api/ai/lesson-plan`
2. API calls `generateLessonPlan()` flow
3. Response rendered in accordion sections
4. Each section is editable (textarea on click)
5. Edits tracked: `editPercentage` calculated as % of fields changed
6. Save → `saveToLibrary()` → `users/{uid}/content`

---

## AI Integration

- **Flow:** `src/ai/flows/lesson-plan-generator.ts`
- **Model:** Gemini via Genkit
- **Grounding:** REMOVED (saved $0.035/call — static lesson content doesn't need live search)
- **Structure:** 5E model — Engage/Explore/Explain/Elaborate/Evaluate
- **Materials audit:** Cross-checks that listed materials are realistic for Indian classrooms
- **Indian context:** Uses `getIndianContextPrompt()` and `IndianContext` examples

---

## Voice Features

- `MicrophoneInput` on topic field — voice → topic auto-fill

---

## Design

- Sidebar (on desktop): tips panel, previous generations
- Input section: left-aligned form
- Display: accordion with colored section headers (one color per 5E step)
- Edit mode: clicking any section converts it to a textarea
- Edit % badge: shows how much teacher has personalized the AI output

---

## Print/PDF

- Wrapped in `<div id="lesson-plan-pdf">` for print CSS
- All accordion items forced open on print (CSS override)
- Exports all 5 sections in structured layout

---

## NCERT Integration

`NCERTChapterSelector` component:
- Server action fetch for chapters → fallback to local data if server fails
- Shows chapter title, learning outcomes, keywords
- When selected, chapter context injected into AI prompt
