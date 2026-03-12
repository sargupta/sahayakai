# Visual Aid Designer — /visual-aid-designer

**File:** `src/app/visual-aid-designer/page.tsx`
**Auth:** Required

---

## Purpose

Generate educational illustrations and diagrams using Gemini image generation. Each image comes with pedagogical context and a discussion spark question.

---

## Component Tree

```
VisualAidDesignerPage
├── Header (title + description)
├── Form
│   ├── LanguageSelector
│   ├── GradeLevelSelector
│   ├── SubjectSelector
│   ├── Topic/description input + MicrophoneInput
│   └── Generate button ("Create Visual Aid")
└── VisualAidDisplay (when result available)
    ├── Generated image (Firebase Storage URL)
    ├── Alt text
    ├── Pedagogical context section
    ├── Discussion spark question
    ├── Save to Library / PDF buttons
    └── FeedbackDialog
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `topic` | `string` | Image description/topic |
| `gradeLevel` | `GradeLevel` | Target grade |
| `subject` | `Subject` | Subject context |
| `language` | `Language` | Language for text sections |
| `result` | `VisualAidSchema \| null` | Generated result |
| `loading` | `boolean` | Generation in flight |

---

## AI Integration

- **Flow:** `src/ai/flows/visual-aid-designer.ts`
- **Model:** Gemini 3 Pro Image Preview (image generation)
- **Cost:** ~$0.04 per image — most expensive feature
- **Output:** `{ imageUrl: string, pedagogicalContext: string, discussionSpark: string, altText: string }`
- **Image storage:** Generated image uploaded to Firebase Storage, URL saved in result

---

## Design

- Image displayed prominently (full width, rounded-2xl)
- Pedagogical context: collapsible section with `BookOpen` icon
- Discussion spark: highlighted card with `MessageCircle` icon
- Save button: persists imageUrl + text to `users/{uid}/content` as `visual-aid`

---

## Cost Note

Image generation is ~$0.04/call. This is the most expensive AI feature in the app. Consider rate limiting per user per day if costs are a concern.
