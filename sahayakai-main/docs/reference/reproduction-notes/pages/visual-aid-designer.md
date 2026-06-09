# Visual Aid Designer - /visual-aid-designer

**File:** `src/app/visual-aid-designer/page.tsx`
**Auth:** Required (generation needs a Bearer token; `requireAuth()` gates submit)
**Snapshot:** 2026-06-10

---

## Purpose

Generate simple black-and-white line drawings (blackboard-style diagrams) for lessons. Each result carries pedagogical context and a discussion-spark focus question. This is the live visual-aid feature (`/visual-aid-creator` is a "coming soon" placeholder).

---

## Component Tree

```
VisualAidDesignerPage
├── Header (translated pageTitle + pageDescription, 11-lang `translations` map in file)
├── Form (react-hook-form + zod)
│   ├── LanguageSelector
│   ├── GradeLevelSelector
│   ├── SubjectSelector
│   ├── Description Textarea + MicrophoneInput (voice description)
│   ├── ExamplePrompts
│   └── Generate button ("Generate Visual Aid")
├── VisualAidDisplay (when result available)
│   ├── Generated image (rendered from data URI / saved storageRef)
│   ├── Pedagogical context
│   ├── Discussion spark question
│   └── Save / Download buttons
└── ShareToCommunityCTA
```

---

## State

- `form` (`FormValues`): `prompt`, `gradeLevel`, `subject`, `language` (ISO via `LANGUAGE_TO_ISO`).
- `result` (`VisualAidOutput \| null`), `loading`.
- VIDYA form sync via `useVidyaFormSync("visual-aid-designer", ...)` restores prompt/grade/subject/language from a saved snapshot.
- Network-aware via `useNetworkAware`.
- Loading a saved item: `?id=` triggers `GET /api/content/get?id=` (imageDataUri stripped on save; `storageRef` kept).

---

## API + AI Integration

- **Route:** `src/app/api/ai/visual-aid/route.ts` (`maxDuration = 120`, wrapped in `withPlanCheck('visual-aid')`).
- **Dispatch:** `dispatchVisualAid` (`src/lib/sidecar/visual-aid-dispatch.ts`); Firestore `visualAidSidecarMode` selects Genkit vs ADK sidecar (default `off`).
- **Flow:** `src/ai/flows/visual-aid-designer.ts`
- **Models:**
  - Image: `googleai/gemini-3-pro-image-preview`
  - Text (pedagogicalContext + discussionSpark): `googleai/gemini-2.5-flash`
- **Output schema (`VisualAidOutputSchema`):** `{ imageDataUri, pedagogicalContext, discussionSpark }`. On save the image is uploaded to Firebase Storage and persisted as `{ ...output, imageDataUri: undefined, storageRef }`.

---

## Cost Note

Image generation is the most expensive AI feature (image model on every call). TODO(verify: current per-image cost; the prior "$0.04/image" figure predates the gemini-3-pro-image-preview switch).
