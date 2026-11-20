# SahayakAI: Project Detail & Technical Reference

**Version:** 2.0
**Date:** 2026-02-16
**Repository:** `sahayakai-main`

---

## 1. Project Overview
**SahayakAI** is a specialized, AI-powered teaching assistant built for the Indian education ecosystem. It addresses the unique challenges of rural teachers—connectivity issues, language barriers, and lack of resources—by providing a voice-first, culturally aware, and offline-capable PWA.

### Core Philosophy
*   **Bharat First:** All content (names, examples, currency, geography) is localized to rural India.
*   **Offline Resilience:** "Hybrid Offline" architecture ensures functionality in low-connectivity zones.
*   **Voice-First:** Designed for non-tech-savvy users, minimizing typing.

## 2. Technical Architecture

### 2.1 Technology Stack
*   **Frontend Framework:** Next.js 15 (App Router, Server Actions)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS + Shadcn/UI (Radix Primitives)
*   **AI Integration:** Google Genkit + Google Vertex AI SDK
*   **LLM Model:** Google Gemini 2.0 Flash (Optimized for speed/cost)
*   **Backend Services:** Firebase (Serverless)
    *   **Auth:** Firebase Authentication
    *   **Database:** Cloud Firestore (NoSQL)
    *   **Storage:** Cloud Storage for Firebase
    *   **Compute:** Cloud Functions for Firebase
*   **Hosting:** Firebase App Hosting (Global CDN)
*   **CI/CD:** GitHub Actions

### 2.2 Application Architecture
The application follows a **Serverless, Event-Driven Architecture**:
1.  **User Input:** Teacher speaks or types a topic (e.g., "The Monsoon").
2.  **Voice Processing:**
    *   Audio is captured via the browser MediaRecorder API (Data URI).
    *   Sent to a Server Action `voiceToText` (Genkit flow).
    *   Transcribed using Gemini 2.0 Flash multimodal capabilities.
3.  **Content Generation:**
    *   Transcribed text + Context (Language, Location) is sent to the appropriate Genkit flow (e.g., `lessonPlanFlow`, `rubricGeneratorFlow`).
    *   **Genkit Flow:**
        *   Validates input via Zod schema.
        *   Constructs a prompt with "Indian Rural Context" injection.
        *   Calls Gemini API.
    *   Returns structured JSON/markdown content.
4.  **UI Rendering:**
    *   Response is parsed and rendered into Glassmorphism UI cards.
    *   Components like `LessonPlanDisplay` and `RubricDisplay` handle the rendering.
5.  **Content Persistence:**
    *   Generated content can be saved to the user's personal `my-library` collection in Firestore.

### 2.3 Key Directories
*   `src/ai/`: Genkit flows, prompts, and model configuration.
    *   `flows/`: Business logic for AI tasks (`lesson-plan-generator.ts`, `rubric-generator.ts`, `voice-to-text.ts`).
    *   `genkit.ts`: Central Genkit instance capability.
*   `src/app/`: Next.js App Router pages and layouts.
*   `src/components/`: Reusable UI components (buttons, cards, specialized displays).
*   `src/lib/`: Utilities and helper functions.
*   `docs/`: Project documentation and strategy files.

## 3. Product Capabilities

> Rewritten 2026-08-23. The previous version of this section listed five
> features (voice, lesson generation, rubrics, offline, multilingual) while the
> codebase shipped sixteen AI tools plus attendance, parent calling, community
> and organisations. A capability list that undercounts the product by that much
> misdirects planning, pitching and hiring, so this section is now derived from
> the shipped route surface rather than maintained by hand.
>
> Source of truth for the customer-facing version: the Capability Brief
> (two pages, generated 2026-08-23).

### 3.1 Preparation and assessment (16 AI tools)

Each has a route under `src/app/api/ai/` and a screen in both web and Android.

| Tool | What it does for a teacher |
|---|---|
| Lesson Plan | NCERT / NCF-2023 aligned plans by grade, subject, chapter |
| Worksheet Wizard | Differentiated worksheets, including from a photo of a textbook page |
| Quiz Generator | Three difficulty tiers, teacher-controlled answer key |
| Exam Paper | Full papers to a board blueprint with marks distribution |
| Rubric Generator | Criterion-and-level grids for any assignment |
| Assess Assignment | Grades student work against a rubric; transcribe-only mode |
| Assessment Scanner | Multi-page, multi-subject answer sheets to a scorecard |
| Instant Answer | Subject questions at classroom register and depth |
| Visual Aid Designer | Blackboard-ready diagrams from a description |
| Video Storyteller | A vetted shelf of teaching videos matched to the lesson |
| Virtual Field Trip | Narrated stop-by-stop journeys with Google Earth links |
| Teacher Training | Pedagogy coaching on the problem in front of the teacher |
| Parent Message | A parent note in their language, ready for WhatsApp |
| Content Creator | Open-ended generation for what the tools do not cover |
| Voice to Text | Indic speech recognition tuned for classroom audio |
| Avatar / Intent | Routes a spoken request to the right tool, pre-filled |

### 3.2 Classroom operations

*   **Attendance register** (`/api/attendance/*`, ten routes) - classes, roster,
    daily marking, monthly summaries, per-student absence history. Writes are
    Pro-plan gated server-side. The markable window is `[today-7, today]`
    computed in IST, so a teacher marking before 05:30 IST is not silently
    rejected. Classes cap at 40 students, roll numbers 1-40, enforced
    transactionally.
*   **Parent Hotline** - an AI places a real phone call to a parent in their
    language, holds a conversation, and returns a transcript and summary.
    Chain: `outreach` -> `call` -> `twiml` -> `twiml-status` -> `call-summary`.
*   **Absence to outreach** - a consecutive-absence run becomes a suggested
    call, carrying the reason through.
*   **Performance tracking** - per-student and per-class views from real marks.

### 3.3 Profession and practice

*   **VIDYA** - voice-first co-teacher on every screen, all eleven languages.
    Turn-based STT -> classifier -> TTS is the shipped path; real-time Live
    voice over Vertex is built and staging-verified, not yet released.
*   **Staffroom** - groups, feed, direct messages, connections.
*   **Library** - every result saved, searchable, re-openable; copy and share.
*   **Organisations** - multi-school administration, invitations, analytics.
*   **Public API** - documented endpoints plus a live playground for partners.

### 3.4 Language and reach

Eleven languages complete rather than partial: Hindi, Bengali, Marathi, Telugu,
Tamil, Gujarati, Kannada, Malayalam, Odia, Punjabi, English. 1,066 interface
strings, zero untranslated in any locale. All ten Indic font families are
bundled in the Android app, so a first launch with no connectivity renders the
teacher's own script rather than fallback boxes.

### 3.5 Offline status (do not overstate)

The app shell and fonts work offline. Full offline authoring is scaffolded, not
general. Claiming offline GA is a known documentation failure mode in this repo;
say "shell and fonts" unless the sync path has been proven end to end.

### 3.6 How capability is verified

Roughly 5,260 automated tests run green across web, Android and the voice
sidecar. They are necessary and not sufficient: all of them mock the telephony
provider, which is why the 2026-08-18 parent-call outage reached a teacher with
a fully green suite. Live capability that depends on a third party is therefore
verified separately, against the real provider:

```
node scripts/verify-call-chain.mjs --from-secrets
```

Read-only, places no call, exit 1 with the failing check named.


## 4. Development Roadmap

### Phase 1: Foundation (Current Status: COMPLETE)
*   [x] Voice Input & Waveform UI
*   [x] Basic Lesson Plan Generator
*   [x] Indian Context Prompt Engineering
*   [x] Glassmorphism UI Theme
*   [x] Rubric Generator

### Phase 2: Offline & Performance (Current Status: ACTIVE)
*   [ ] Complete PWA Manifest & Service Worker integration.
*   [ ] Implement "Quick Templates" (Pre-generated common topics).
*   [ ] "Semantic Cache" to reduce API costs.

### Phase 3: Differentiation
*   [ ] Multi-level content (Remedial vs. Advanced).
*   [ ] Board Exam alignment (NCERT/CBSE pattern database).

### Phase 4: Community
*   [ ] Teacher profiles (`my-profile`).
*   [ ] Personal content library (`my-library`).
*   [ ] Content sharing & "Remixing" lesson plans.

## 5. Deployment & Setup

### Prerequisites
*   Node.js v20+
*   Firebase CLI
*   Google Cloud Project (with Vertex AI API enabled)

### Local Development
```bash
# 1. Install dependencies
npm install

# 2. Configure Environment
# Create .env.local with Firebase keys

# 3. Run Dev Server
npm run dev
# App runs at http://localhost:3000
```

### Deployment
Deployment to production is handled automatically by a GitHub Actions workflow. Pushing changes to the `main` branch will trigger the deployment process.

---
**Approved By:** Engineering Lead
**Reference:** `PROJECT_SNAPSHOT.md`, `STRATEGIC_REVIEW.md`, `GEMINI.md`
