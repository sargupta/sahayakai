# AI Output Display Components

_Last verified against source: 2026-06-10._

All display components follow the same pattern: receive AI-generated data, render it in a print-ready layout via the shared `ResultShell` primitive, and expose copy/save/PDF/share actions.

**Shared infrastructure (all display components):**
- Wrapped in `<ResultShell id={PDF_ID} title icon actions extraActions footer>` from `@/components/ui/result-shell`. `ResultShell` renders the action toolbar; each action is `{ label, icon, onClick }`.
- PDF export uses `exportElementToPdf({ elementId: PDF_ID, filename })` from `@/lib/export-pdf` (jsPDF + html2canvas rasterisation). It is NOT `window.print()`. Returns `{ ok }`; component toasts success or destructive failure.
- Save uses `fetch("/api/content/save", { method: "POST", headers: { Authorization: Bearer <idToken> }, body: { id: crypto.randomUUID(), type, title, gradeLevel, subject, topic, language, isPublic:false, isDraft:false, data } })`. The Firebase id token comes from a lazily imported `auth.currentUser`; a missing user yields a login-required toast.
- Share uses `<QuickShareButton contentType=... onSave={handleSave} />` passed as `extraActions`.
- All user-facing action/toast strings come from `getResultShellDict(language)` (`@/lib/result-shell-i18n`). Body labels that fall outside that dict use `useLanguage().t()`.

---

## InstantAnswerDisplay

**File:** `src/components/instant-answer-display.tsx`

**Props:** `{ answer: InstantAnswerOutput & { videoSuggestionUrl?: string | null }, title?: string, selectedLanguage?: string }`

**Sections:**
- Answer body: markdown rendered via `react-markdown` inside `prose prose-slate`.
- Optional YouTube suggestion: rendered only when `answer.videoSuggestionUrl` is set, as a red callout with a "Watch on YouTube" button (`window.open(url, "_blank")`).
- Actions: Copy (`navigator.clipboard`), Save, PDF.
- `extraActions`: `QuickShareButton` (contentType `instant-answer`).

**Icon:** `MessageSquareQuote`. **Variant:** `glass`.
**PDF_ID:** `instant-answer-card`.

Note: no Google Search grounding citation block and no FeedbackDialog in this component as of 2026-06-10.

---

## LessonPlanDisplay

**File:** `src/components/lesson-plan-display.tsx`

**Props:** `LessonPlanDisplayProps` keyed off `LessonPlanOutput` (`@/ai/flows/lesson-plan-generator`).

**Sections:**
- Radix `Accordion` of collapsible plan sections.
- Inline editing: sections become editable (Input/Textarea) on click; gated by `useSubscription` (Lock icon for locked tiers).
- Markdown is rendered by a local `renderMarkdown` helper that HTML-escapes first (XSS guard against AI output) then applies bold/italic/line-break substitutions.
- Actions: Copy, Save, PDF; `FeedbackDialog`; `QuickShareButton`.

**PDF_ID:** `lesson-plan-pdf`.

---

## QuizDisplay

**File:** `src/components/quiz-display.tsx`

**Props:** `{ quiz: QuizVariantsOutput }` (`@/ai/schemas/quiz-generator-schemas`).

**Sections:**
- Radix `Tabs` across difficulty variants.
- Per-question inline edit (Input/Textarea), single-question regenerate (`RotateCw`/`Loader2`), Add Question (`Plus`).
- Answer-key visibility toggle (`Eye`/`EyeOff`).
- Per-question and global thumbs feedback (`handleFeedback(idx, "up"|"down")`).
- Actions include Copy, Save (type `quiz`), PDF, Print.

**PDF_ID:** `print-area`.

---

## RubricDisplay

**File:** `src/components/rubric-display.tsx`

**Structure:** Tabular rubric (criteria × performance levels). Save type `rubric`.

**PDF_ID:** `rubric-pdf`.

---

## WorksheetDisplay

**File:** `src/components/worksheet-display.tsx`

**Structure:** Title, instructions, rendered worksheet content. Save type `worksheet`.

**PDF_ID:** `worksheet-pdf`.

TODO(verify: whether KaTeX/`$...$` math rendering is still present in worksheet-display.tsx - earlier doc claimed it).

---

## VisualAidDisplay

**File:** `src/components/visual-aid-display.tsx`

**Props:** `{ visualAid: VisualAidOutput, title: string, gradeLevel?: string, language?: string }`

**Structure:**
- `next/image` (`unoptimized`, `aspect-square`, `max-w-[512px]`) of `visualAid.imageDataUri`. Falls back to an `Images` placeholder card with "Image not stored. Edit the prompt and click Generate to recreate." when no data URI.
- Two info panels: Pedagogical Context (`visualAid.pedagogicalContext`) and Discussion Spark (`visualAid.discussionSpark`), styled with `bg-accent/10 border-primary/20` (theme tokens, not hardcoded orange).
- Save short-circuits with an "Already in Library" toast when `visualAid.storagePath` is set (auto-saved at generation time).
- `footer`: `FeedbackDialog` (page `visual-aid`). `extraActions`: `QuickShareButton`.

**Icon:** `Images`. **Size:** `compact`. **Variant:** `glass`.
**PDF_ID:** `visual-aid-card`.

---

## VirtualFieldTripDisplay

**File:** `src/components/virtual-field-trip-display.tsx`

**Structure:** Trip overview plus numbered stop cards (name, Google Earth link, description, analogy, facts, reflection). Save type `virtual-field-trip`.

**PDF_ID:** `field-trip-card`.

---

## TeacherTrainingDisplay

**File:** `src/components/teacher-training-display.tsx`

**Structure:** Strategy cards, actionable steps, pedagogy note. Save type `teacher-training`.

**PDF_ID:** `teacher-training-card`.

---

## Common Action Pattern (all display components)

```
Copy:   navigator.clipboard.writeText(text) → toast (getResultShellDict)
Save:   POST /api/content/save with Bearer idToken + { type, title, data, ... } → toast
PDF:    exportElementToPdf({ elementId: PDF_ID, filename }) → toast ok/destructive
Share:  <QuickShareButton contentType={type} onSave={handleSave} />
```

PDF_ID values are NOT uniform: `instant-answer-card`, `lesson-plan-pdf`, `print-area` (quiz), `rubric-pdf`, `worksheet-pdf`, `visual-aid-card`, `field-trip-card`, `teacher-training-card`.
