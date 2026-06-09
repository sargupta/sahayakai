# SahayakAI Whitepaper: An AI-Powered Teaching Assistant for India

**Last updated:** 2026-06-10

## Abstract
This whitepaper outlines the architecture and technical details of SahayakAI, an AI-powered teaching assistant that addresses India's systemic education-quality crisis across all school types. While low-resource and intermittent-connectivity classrooms are a core design constraint, the platform's `resourceLevel` setting (low, medium, high) lets it serve well-resourced classrooms equally. SahayakAI is a Progressive Web App (PWA) that provides a suite of tools for creating lesson plans, rubrics, and other teaching materials. The platform is "Bharat First," with a focus on cultural relevance, language coverage, and ease of use. It leverages a serverless Cloud Run architecture, Google's Gemini language models, and the Genkit framework.

## 1. The Problem: The Digital Divide in Indian Education
Teachers in rural India face a unique set of challenges that are not addressed by most existing educational technology platforms. These challenges include:
*   **Limited Internet Connectivity:** Internet access is often unreliable or unavailable, making cloud-based solutions impractical.
*   **Resource Constraints:** Schools may lack basic resources such as computers, projectors, or even textbooks.
*   **Language Barriers:** Teachers and students may speak a variety of regional languages, and English proficiency may be limited.
*   **Lack of Culturally Relevant Content:** Most educational content is designed for a Western audience and is not relevant to the lives of students in rural India.
*   **Time Constraints:** Teachers are often overworked and have limited time for lesson planning.

## 2. The Solution: SahayakAI
SahayakAI is a "Bharat First" AI-powered teaching assistant that is designed to address these challenges. The platform is built on the following core principles:
*   **Offline-First:** SahayakAI is a PWA that can be used offline. Generated content is cached locally, and can be accessed even without an internet connection.
*   **Voice-First:** The platform is designed to be used with voice commands, making it accessible to teachers who are not comfortable with typing.
*   **Culturally Relevant:** All content is localized to the Indian context, with a focus on rural examples.
*   **Resource-Aware:** The platform can generate content that is appropriate for a variety of resource levels, from "chalk and blackboard only" to a fully equipped classroom.
*   **Easy to Use:** The platform is designed to be simple and intuitive, even for teachers who are not tech-savvy.

## 3. Technical Architecture
SahayakAI is built on a serverless architecture using Google Cloud and Firebase.

### 3.1 High-Level Architecture
*   **Frontend + Backend:** A single Next.js application (App Router) deployed on Google Cloud Run (service `sahayakai-hotfix-resilience`, region `asia-southeast1`). API route handlers under `src/app/api/**` serve all backend logic; there are no separate Cloud Functions.
*   **AI/ML:** AI capabilities are provided by Google's Gemini models, accessed through the Genkit framework. Genkit defines and orchestrates roughly 17 AI flows plus the VIDYA voice assistant. An optional external ADK-Python sidecar can serve selected agents, gated by Firestore feature flags (default off, so Genkit serves by default).
*   **Database:** Cloud Firestore is the primary database for user data and generated content; feature flags live at `system_config/feature_flags`.
*   **Authentication:** Firebase Authentication, with ID tokens verified in middleware and injected as `x-user-id` headers.
*   **Storage:** Cloud Storage for Firebase for user-uploaded files.
*   **Payments:** Razorpay, with HMAC-verified webhooks.
*   **CI/CD:** A Cloud Build GitHub trigger deploys on push to `main`.

### 3.2 AI and Machine Learning
SahayakAI uses Google's `gemini-2.5-flash` as its default model (optimized for speed and cost). Assignment grading uses `gemini-2.5-pro`; image generation uses `gemini-3-pro-image-preview` (visual aids) and `gemini-2.5-flash-image` (avatars).

The AI flows are defined using Genkit, a new open-source framework from Google that is designed to simplify the development of AI-powered applications. Genkit allows for the easy definition of AI prompts, the validation of inputs and outputs using Zod schemas, and the orchestration of complex AI workflows.

The platform's "Bharat First" approach is implemented through a set of "Indian Rural Context" instructions that are injected into the AI prompts. These instructions guide the AI to generate content that is culturally relevant and appropriate for the target audience.

## 4. Roadmap and Future Work
The future roadmap for SahayakAI includes the following:
*   **Community Features:** A community hub where teachers can share and discover content, and collaborate with each other.
*   **Parent Communication:** Tools to help teachers communicate with parents, including parent-friendly summaries of student progress.
*   **Differentiated Instruction:** The ability to generate content for different learning levels, from remedial to advanced.
*   **NCERT Curriculum Alignment:** Aligning the platform's content with the official Indian curriculum.
*   **Semantic Caching:** A caching layer that can reuse similar lesson plans across teachers, reducing API costs and improving performance.
*   **Mobile App:** A native mobile app for Android and iOS, with a focus on offline-first functionality.

## 5. Conclusion
SahayakAI is a promising new platform that has the potential to make a real difference in the lives of teachers and students in rural India. By leveraging the power of AI and a "Bharat First" approach, SahayakAI is well-positioned to bridge the digital divide in Indian education and help to create a more equitable and effective learning environment for all.
