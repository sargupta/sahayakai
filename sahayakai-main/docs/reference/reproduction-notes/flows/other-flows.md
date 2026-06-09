# AI Flows: Full Set (Reference)

> Refreshed 2026-06-10 against current source. This file summarizes every
> `src/ai/flows/*.ts` flow with its model and route. Flows with their own
> dedicated note (agent-router, instant-answer, lesson-plan, quiz) are listed
> in the table for completeness but documented in their own files.

All flows are plain server modules (NO `'use server'`); pages call them only via `/api/ai/*` routes (or `/api/assistant`, `/api/attendance/*`). The default model is `googleai/gemini-2.5-flash` from `src/ai/genkit.ts` (overridable via `GENKIT_DEFAULT_MODEL`). `gemini-2.0-flash` is NOT used anywhere - it was removed for free-tier per-minute quota saturation.

---

## Model Map (current)

| Flow file | Route | Model |
|---|---|---|
| `lesson-plan-generator.ts` | `/api/ai/lesson-plan` (+ `/stream`) | `gemini-2.5-flash` (+ audit sub-call `gemini-2.5-flash`) |
| `quiz-generator.ts` / `quiz-definitions.ts` | `/api/ai/quiz` | `gemini-2.5-flash` |
| `exam-paper-generator.ts` | `/api/ai/exam-paper` (+ `/stream`) | `gemini-2.5-flash` |
| `worksheet-wizard.ts` | `/api/ai/worksheet` | `gemini-2.5-flash` |
| `rubric-generator.ts` | `/api/ai/rubric` | `gemini-2.5-flash` |
| `instant-answer.ts` | `/api/ai/instant-answer` | `gemini-2.5-flash` (Google Search grounding) |
| `visual-aid-designer.ts` | `/api/ai/visual-aid` | image `gemini-3-pro-image-preview` (`:131`); text `gemini-2.5-flash` (`:177`) |
| `avatar-generator.ts` | `/api/ai/avatar` | `gemini-2.5-flash-image` (`:52`) |
| `video-storyteller.ts` | `/api/ai/video-storyteller` | `gemini-2.5-flash` (TODO(verify: local-ranking-only path vs LLM call)) |
| `virtual-field-trip.ts` | `/api/ai/virtual-field-trip` | `gemini-2.5-flash` |
| `teacher-training.ts` | `/api/ai/teacher-training` | `gemini-2.5-flash` |
| `assignment-assessor.ts` | `/api/ai/assess-assignment` | `gemini-2.5-pro` (`ASSESSMENT_MODEL`, `:28`/`:122`) |
| `assessment-scanner.ts` | `/api/ai/assessment-scanner` | `gemini-2.5-flash` (default; no explicit override) |
| `parent-message-generator.ts` | `/api/attendance/...` / `/api/ai/parent-message` | `gemini-2.5-flash` |
| `parent-call-agent.ts` | `/api/attendance/twiml`, `/call-summary` | `gemini-2.5-flash` |
| `community-persona-message.ts` | community jobs / `/api/community/*` | `gemini-2.5-flash` (150-token cap) |
| `vidya-assistant.ts` | `/api/assistant` | `gemini-2.5-flash` |
| `agent-router.ts` / `agent-definitions.ts` | `/api/ai/intent` | `gemini-2.5-flash` |
| `voice-to-text.ts` | `/api/ai/voice-to-text` | Sarvam STT primary; `gemini-2.5-flash` fallback |

Distinct non-2.5-flash models: `gemini-2.5-pro` (assignment grading), `gemini-3-pro-image-preview` (visual-aid image), `gemini-2.5-flash-image` (avatar).

Validation companions (no separate model): `assignment-assessor-validation.ts`, `quiz-definitions-enhanced-validation.ts`, `virtual-field-trip-validation.ts`, `worksheet-validation.ts`. Evaluators (`src/ai/evaluators/`): `lesson-plan-alignment.ts`, `quiz-quality.ts` - both `gemini-2.5-flash`.

---

## Rubric Generator

**File:** `src/ai/flows/rubric-generator.ts` - **Route:** `/api/ai/rubric` - **Model:** `gemini-2.5-flash`.

Generates a grading rubric. Level names translated to the output language; criteria names subject-appropriate.

TODO(verify: exact input/output Zod schema - confirm criteria-count enum and the level structure against current `rubric-generator.ts`; prior doc claimed a fixed 4-level exemplary/proficient/developing/beginning shape).

---

## Teacher Training

**File:** `src/ai/flows/teacher-training.ts` - **Route:** `/api/ai/teacher-training` - **Model:** `gemini-2.5-flash`.

Professional-development / classroom-management coaching grounded in pedagogy frameworks and Indian classroom realities.

TODO(verify: exact output schema fields - confirm against current source).

---

## Exam Paper Generator

**File:** `src/ai/flows/exam-paper-generator.ts` - **Route:** `/api/ai/exam-paper` (+ `/stream`) - **Model:** `gemini-2.5-flash`.

Full board-style examination paper (sections, marks distribution, time duration). Distinct from the quiz flow (in-class formative). Supports streaming.

TODO(verify: input/output schema for the exam-paper flow).

---

## Video Storyteller

**File:** `src/ai/flows/video-storyteller.ts` - **Route:** `/api/ai/video-storyteller`.

Curates educational videos. The prior note described a local-ranking pipeline (pre-curated YouTube channels + RSS + YouTube API fallback, no LLM). TODO(verify: whether this flow currently issues any `gemini-2.5-flash` call vs pure local ranking - the ground-truth lists `videoStoryteller.prompt`, which implies an LLM step exists).

---

## Virtual Field Trip

**File:** `src/ai/flows/virtual-field-trip.ts` - **Validation:** `virtual-field-trip-validation.ts` - **Route:** `/api/ai/virtual-field-trip` - **Model:** `gemini-2.5-flash`.

Generates a virtual field trip (stops with Google Earth URLs, Indian-context analogies, educational facts, reflection prompts). Validation layer checks Google Earth URL format and falls back to a generic `earth.google.com` URL on invalid output.

TODO(verify: exact stop-count enum and output schema).

---

## Visual Aid Designer

**File:** `src/ai/flows/visual-aid-designer.ts` - **Route:** `/api/ai/visual-aid`.

Two-model flow: image generation via `googleai/gemini-3-pro-image-preview` (`:131`); pedagogical text (context + discussion spark) via `googleai/gemini-2.5-flash` (`:177`). Image saved to Firebase Storage. Most expensive feature class (image generation ~$0.04/image). Note: the legacy `/visual-aid-creator` route also exists alongside `/visual-aid-designer`.

TODO(verify: exact output field names against current source).

---

## Avatar Generator

**File:** `src/ai/flows/avatar-generator.ts` - **Route:** `/api/ai/avatar` - **Model:** `googleai/gemini-2.5-flash-image` (`:52`).

Generates a teacher avatar image. Image-generation cost class.

---

## Assignment Assessor

**File:** `src/ai/flows/assignment-assessor.ts` - **Validation:** `assignment-assessor-validation.ts` - **Route:** `/api/ai/assess-assignment` - **Model:** `googleai/gemini-2.5-pro` (`ASSESSMENT_MODEL`, `:28`/`:122`).

Grades assignment images (vision + reasoning). Uses `gemini-2.5-pro` because grading quality matters more than cost. Distinct from `assessment-scanner.ts`.

---

## Assessment Scanner

**File:** `src/ai/flows/assessment-scanner.ts` - **Route:** `/api/ai/assessment-scanner` (+ `/api/ai/assessment-scanner/[id]`) - **Model:** `gemini-2.5-flash` (default; no explicit override found).

Scans / grades handwritten assessments.

TODO(verify: input/output schema and whether any explicit model override exists).

---

## Parent Message Generator

**File:** `src/ai/flows/parent-message-generator.ts` - **Model:** `gemini-2.5-flash` (`parentMessage.prompt`).

Drafts a parent outreach message. The route injects the Gemini API key explicitly (recent fix, commit `f65f60e38`).

---

## Parent Call Agent

**File:** `src/ai/flows/parent-call-agent.ts` - **Model:** `gemini-2.5-flash` (`parentCallAgentReply.prompt`, `parentCallSummary.prompt`).

Generates live conversational replies and a post-call summary inside the Twilio TwiML webhook budget (~15s). See telephony in ARCHITECTURE.md (Twilio default, Exotel opt-in).

---

## Community Persona Message

**File:** `src/ai/flows/community-persona-message.ts` - **Model:** `gemini-2.5-flash` (150-token cap).

AI community-persona chat replies (community activity loop / persona pool jobs).

---

## VIDYA Assistant

**File:** `src/ai/flows/vidya-assistant.ts` - **Route:** `/api/assistant` - **Model:** `googleai/gemini-2.5-flash` (`:413`).

Generates the VIDYA voice-assistant reply for the OmniOrb. Intent classification is handled separately by `agent-router.ts` / `agent-definitions.ts` (see agent-router.md).

---

## Voice to Text

**File:** `src/ai/flows/voice-to-text.ts` - **Route:** `/api/ai/voice-to-text`.

STT with Sarvam AI (Saaras) as the primary path for Indian languages (cheaper, purpose-built; accepts mpeg/mp3/wav). Falls back to `gemini-2.5-flash` multimodal transcription for `webm`/`opus` audio. Used by MicrophoneInput and OmniOrb voice recording.

---

## Worksheet Wizard

**File:** `src/ai/flows/worksheet-wizard.ts` - **Validation:** `worksheet-validation.ts` - **Route:** `/api/ai/worksheet` - **Model:** `gemini-2.5-flash`.

Differentiated worksheets; multimodal when an image is supplied. Output may contain LaTeX math; validation checks LaTeX before returning.

TODO(verify: exact input/output schema and LaTeX-fallback behaviour against current source).
