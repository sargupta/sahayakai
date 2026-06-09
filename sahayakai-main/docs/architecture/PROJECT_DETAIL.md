# SahayakAI: Project Detail & Technical Reference

**Version:** 2.1
**Last Updated:** 2026-06-10
**Repository:** `sahayakai-main`

---

## 1. Project Overview
**SahayakAI** is a specialized, AI-powered teaching assistant built for the Indian education ecosystem. It serves teachers across all school types (government, private, and chain), addressing connectivity constraints, language barriers, and resource gaps with a voice-first, culturally aware PWA.

### Core Philosophy
*   **Bharat First:** Content (names, examples, currency, geography) is localized to Indian contexts.
*   **Offline Resilience:** PWA service-worker caching for the web shell; a Flutter offline path is in development.
*   **Voice-First:** Designed for non-tech-savvy users, minimizing typing.

## 2. Technical Architecture

### 2.1 Technology Stack
*   **Frontend Framework:** Next.js 15 (App Router, React 18)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS + Shadcn/UI (Radix Primitives)
*   **AI Integration:** Google Genkit (`@genkit-ai/googleai` plugin)
*   **LLM Models:** Google Gemini. Default text model `gemini-2.5-flash`; `gemini-2.5-pro` (assignment grading); `gemini-3-pro-image-preview` (visual-aid images); `gemini-2.5-flash-image` (avatars). `gemini-2.0-flash` is no longer used.
*   **Backend Services:** Firebase + GCP
    *   **Auth:** Firebase Authentication (ID token verified in Next.js middleware via `jose`)
    *   **Database:** Cloud Firestore (NoSQL)
    *   **Storage:** Cloud Storage for Firebase
    *   **Compute:** Single Next.js server (API route handlers) on Cloud Run, service `sahayakai-hotfix-resilience`, region `asia-southeast1`, project `sahayakai-b4248`
*   **Payments:** Razorpay (HMAC-verified webhooks at `/api/webhooks/razorpay`)
*   **Telephony:** Twilio REST (default) or Exotel (opt-in via `VOICE_PROVIDER`) for parent attendance calls
*   **CI/CD:** Cloud Build trigger `sahayakai-main-deploy` on push to `main` (builds a `--no-traffic` Cloud Run revision)

### 2.2 Application Architecture
The application runs as a single Next.js server on Cloud Run; AI work happens in server-side Genkit flows behind `/api/ai/*` route handlers:
1.  **User Input:** Teacher speaks or types a topic (e.g., "The Monsoon").
2.  **Voice Processing:**
    *   Audio is captured via the browser MediaRecorder API.
    *   Sent to `/api/ai/voice-to-text` (the `voice-to-text` flow).
    *   Transcribed via Sarvam AI (Saaras) as the primary STT path for Indian languages, with Gemini 2.5 Flash as fallback (e.g., for webm/opus).
3.  **Content Generation:**
    *   Transcribed text + context (language, location) is sent to the appropriate Genkit flow (e.g., `lessonPlanFlow`, `rubricGeneratorFlow`) via its API route.
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

## 3. Product Features (Deep Dive)

### 3.1 Voice-First Interface
*   **Implementation:** `MicrophoneInput` component.
*   **Details:** Uses Web Audio API for real-time waveform visualization. Records audio chunks and converts to Base64 Data URI for server-side processing.

### 3.2 Context-Aware Lesson Generation
*   **Logic:** `src/ai/flows/lesson-plan-generator.ts`
*   **Feature:** Automatically injects "Rural Context" instructions:
    *   *Food:* Pizza -> Roti/Dal
    *   *Currency:* Dollars -> Rupees
    *   *Geography:* Western -> Indian (Ganga, Himalayas)
    *   *Resources:* Assumes Chalk/Board only unless specified.

### 3.3 Rubric Generator
*   **Logic:** `src/ai/flows/rubric-generator.ts`
*   **Feature:** Generates detailed, structured rubrics for assignments based on a description. Includes performance levels, criteria, and points.

### 3.4 Offline PWA Support (In-Progress)
*   **Service Workers:** Caches static assets (JS, CSS, Images).
*   **Strategy:** "Stale-while-revalidate" for UI shell.
*   **Future:** `IndexedDB` implementation for storing generated content ("Store & Forward").

### 3.5 Multilingual Support
*   **Languages:** 11 Indic languages: Hindi, English, Bengali, Tamil, Kannada, Malayalam, Gujarati, Punjabi, Telugu, Marathi, plus Odia (TTS falls back phonetically for Odia).
*   **Implementation:** Language context passes language codes to the AI prompt; TTS uses Google Cloud TTS (Neural2 > Wavenet > Standard tiers) and Sarvam AI.

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
*   Google Cloud Project with a Gemini API key (set via Secret Manager `GOOGLE_GENAI_API_KEY` in prod; `.env.local` for dev)

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
A Cloud Build trigger (`sahayakai-main-deploy`) fires on push to `main` and builds a Cloud Run revision with `--no-traffic`. Traffic is flipped manually after `./scripts/audit-deployments.sh` passes:
```bash
gcloud run services update-traffic sahayakai-hotfix-resilience \
  --region=asia-southeast1 --project=sahayakai-b4248 --to-latest
```
Never run raw `gcloud run deploy`; use `scripts/safe-deploy.sh` as the guarded fallback. See `AGENTS.md` and `docs/architecture/SOLUTION_ARCHITECTURE.md`.

---
**Reference:** `docs/architecture/SOLUTION_ARCHITECTURE.md`, `AGENTS.md`, `gemini.md`, `docs/reference/reproduction-notes/ARCHITECTURE.md`
