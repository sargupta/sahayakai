# Teacher Training - /teacher-training

**File:** `src/app/teacher-training/page.tsx`
**Auth:** Required
**Snapshot:** 2026-06-10

---

## Purpose

Personalized professional development coaching. Teacher describes a challenge they're facing in the classroom; AI provides pedagogy-grounded strategies with actionable steps.

---

## Component Tree

```
TeacherTrainingPage
├── Header (title + description)
├── Form
│   ├── LanguageSelector
│   ├── GradeLevelSelector
│   ├── SubjectSelector
│   ├── Challenge/question input (Textarea) + MicrophoneInput
│   └── Get Coaching button
└── TeacherTrainingDisplay (when result available)
    ├── Strategy cards (each with icon, title, description)
    ├── Pedagogy explanation section
    ├── Actionable steps list
    ├── Copy / Save / PDF buttons
    └── FeedbackDialog
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `challenge` | `string` | Teacher's classroom challenge |
| `gradeLevel` | `GradeLevel` | Grade context |
| `subject` | `Subject` | Subject context |
| `language` | `Language` | Output language |
| `result` | `object \| null` | AI coaching response |
| `loading` | `boolean` | In flight |

---

## API + AI Integration

- **Route:** `POST /api/ai/teacher-training` (wrapped in `withPlanCheck('teacher-training')`).
- **Dispatch:** `dispatchTeacherTraining` (`src/lib/sidecar/teacher-training-dispatch.ts`); Firestore `teacherTrainingSidecarMode` selects Genkit vs ADK sidecar (default `off`).
- **Flow:** `src/ai/flows/teacher-training.ts`
- **Model:** `googleai/gemini-2.5-flash`
- **Indian context:** Examples tailored to Indian classroom realities (large class sizes, mixed ability, limited resources).
- **Output:** `{ introduction, advice, conclusion, gradeLevel, subject }`.

---

## TeacherTrainingDisplay

- Each strategy rendered as a card with `GraduationCap` icon
- Actionable steps as numbered list
- Pedagogy note in highlighted callout box
- Save to library → type `teacher-training`

---

## Design

- Textarea for challenge input (3+ lines, resizable)
- Strategy cards: white background, left border accent in orange-500
- Steps: numbered list with slate-900 text
- Pedagogy callout: soft orange background, italic text
