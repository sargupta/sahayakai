# SahayakAI: AI-Powered Teaching Assistant for India

**Last updated:** 2026-06-10

**SahayakAI** is a "Bharat First" AI-powered teaching assistant for teachers across all Indian school types. It addresses India's systemic education-quality crisis by helping teachers create high-quality, culturally relevant lesson plans and teaching materials, adapting to each classroom's resource level (low, medium, high).

## Project Goal
The primary goal of SahayakAI is to raise teaching quality at scale by giving teachers a practical, easy-to-use assistant that understands their curriculum, language, and classroom context.

## Core Features
The platform ships roughly 17 Genkit AI flows plus the VIDYA voice assistant, including:
*   **Lesson Plan Generator, Quiz Generator, Exam Paper Generator, Worksheet Wizard, Rubric Generator.**
*   **Instant Answer:** Grounded Q&A using Google Search grounding.
*   **Visual Aid (image + text), Avatar Generator, Video Storyteller, Virtual Field Trip, Teacher Training.**
*   **Assignment Assessor and Assessment Scanner:** Grade assignments and scan handwritten work.
*   **Attendance + Parent Outreach:** Draft parent messages and place AI parent calls (Twilio default, Exotel streaming opt-in).
*   **VIDYA:** Voice-first assistant (OmniOrb mic) with an 11-intent router.
*   **Community:** Resource sharing, teacher directory, and community chat.
*   **Indian Context, Multilingual (11 Indic languages), PWA / offline-capable.**

## Current Status
Core features are implemented and the platform is in pilot. Usage, retention, and pilot-outcome metrics: `TODO(verify: active users, pilot results, retention)`.

## Technology Stack
*   **Frontend:** Next.js (App Router, React).
*   **AI:** Google Gemini via Genkit (default `gemini-2.5-flash`).
*   **Backend:** Firebase (Auth, Firestore, Storage) on Google Cloud Run.
*   **Payments:** Razorpay. **Telephony:** Twilio / Exotel.
*   **Deployment:** Cloud Build GitHub trigger to Cloud Run (`asia-southeast1`).

## Roadmap
`TODO(verify: roadmap dates/milestones)`. Active directions include deeper community features, expanded parent communication, differentiated instruction, and NCERT curriculum alignment (NCERT data already present in Firestore).
