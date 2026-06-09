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
*   **Languages:** English, Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada.
*   **Implementation:** `LanguageSelector` passes language codes to the AI prompt.

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
