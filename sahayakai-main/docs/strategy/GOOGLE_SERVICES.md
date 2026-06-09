# Google Services in Sahayakai

**Last updated:** 2026-06-10

This document provides a comprehensive overview of the Google services and technologies used throughout the Sahayakai application. Each service is detailed with its specific use case and significance.

## 1. Firebase

Firebase is a comprehensive mobile and web application development platform. In Sahayakai, it serves as the core backend infrastructure.

### 1.1. Firebase Authentication

-   **Use Case:** Manages user sign-up and sign-in processes.
-   **Significance:** Provides a secure, scalable, and easy-to-implement authentication system out-of-the-box, saving significant development time and ensuring a high level of security for user accounts.

### 1.2. Firestore

-   **Use Case:** The primary NoSQL database for storing user data, generated content (like lesson plans and quizzes), and application state.
-   **Significance:** Firestore is a highly scalable and real-time database, allowing for seamless data synchronization across clients. Its flexible data model is ideal for the varied and evolving data structures required by Sahayakai's different features.

### 1.3. Firebase Storage

-   **Use Case:** Stores user-uploaded binary files, such as images for visual aids or textbook pages for worksheet generation.
-   **Significance:** Provides a robust, secure, and scalable solution for user-generated content. It integrates seamlessly with the rest of Firebase and Google Cloud, simplifying file management and access control.

### 1.4. Firebase Admin SDK

-   **Use Case:** Used on the server-side for privileged operations that cannot be performed by the client, such as minting custom authentication tokens or performing administrative database operations.
-   **Significance:** Enables secure and powerful backend processes. By handling sensitive operations on the server, it protects the application from client-side tampering and ensures data integrity.

## 2. Genkit (and Google AI Platform)

Genkit is an open-source framework from Google designed to streamline the development of AI-powered applications.

-   **Use Case:** Genkit is the backbone of Sahayakai's AI capabilities. It is used to define, orchestrate, and manage all AI-powered "flows" (e.g., `lesson-plan-generator`, `quiz-generator`).
-   **Significance:** Genkit provides a structured and maintainable way to build complex AI features. It simplifies the integration of different models, tools (like Google Search), and data sources, while also providing built-in observability and tracing, which is crucial for debugging and monitoring AI applications.

## 3. Gemini Models

Gemini is a family of powerful, multimodal large language models (LLMs) from Google.

-   **Use Case:** `gemini-2.5-flash` is the default AI engine for most generative features (lesson plans, quizzes, rubrics, instant answers, worksheets, and more). `gemini-2.5-pro` is used for assignment grading (vision + reasoning). Image generation uses `gemini-3-pro-image-preview` (visual aids) and `gemini-2.5-flash-image` (avatars).
-   **Significance:** Gemini's reasoning, multilingual, and multimodal capabilities let Sahayakai generate high-quality, contextually relevant educational content and interpret uploaded images.

## 4. Google Search Grounding

Google Search grounding is integrated as a tool for the AI models.

-   **Use Case:** The "Instant Answer" feature uses Google Search grounding to fetch real-time, up-to-date information. (Grounding was deliberately removed from lesson-plan generation for cost.)
-   **Significance:** Grounding lets the AI answer questions about current events or topics outside its training data, keeping information accurate and timely.

## 5. Google Cloud Run

-   **Use Case:** Hosts the Next.js application (service `sahayakai-hotfix-resilience`, region `asia-southeast1`, project `sahayakai-b4248`), deployed via a Cloud Build GitHub trigger.
-   **Significance:** Serverless, pay-per-use compute that scales to demand.

## 6. Google Cloud Text-to-Speech

-   **Use Case:** Powers voice output across 11 Indic languages, with a Neural2 > Wavenet > Standard tier priority. (Sarvam AI is used as the primary STT path for Indian languages, with Gemini fallback.)
-   **Significance:** Enables the voice-first experience for low-literacy users and audio playback of generated content.
