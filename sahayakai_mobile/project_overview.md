# SahayakAI Mobile: Comprehensive Project Overview

## 1. Project Vision
**SahayakAI Mobile** is a "Bharat-First" AI companion for educators, designed to eliminate administrative burnout and empower teachers with creative, professional tools. The app transforms a standard utility interface into "Sahayak Studio"—a suite of premium, distinct creative workspaces.

---

## 2. Application Organization & Architecture
The project follows a **Feature-Sliced Design (FSD)** inspired architecture with a Clean Architecture separation of concerns.

### Directory Structure (`lib/src`)
```
lib/src/
├── core/                  # Core infrastructure shared across features
│   ├── theme/             # Saffron Design System (Colors, Typography, Themes)
│   ├── database/          # Isar Database Service (Offline-first)
│   ├── network/           # API Clients (Dio/HTTP)
│   └── providers/         # Global Riverpod providers (User, Language)
│
├── features/              # Feature directories (Self-contained modules)
│   ├── home/              # Dashboard, Drawer, Navigation
│   ├── lesson_plan/       # Lesson Planner Tool
│   ├── quiz/              # Quiz Generator Tool
│   ├── video/             # Video Storyteller Tool
│   ├── visual_aid/        # Visual Aid Creator Tool
│   ├── worksheet/         # Worksheet Wizard Tool
│   ├── rubric/            # Rubric Generator Tool
│   ├── content_creator/   # Editor's Desk (Emails, Notes)
│   ├── training/          # Teacher Academy
│   └── community/         # Community Hub
│
└── main.dart              # Entry point, Route registration, Theme setup
```

### Architectural Pattern
*   **Presentation Layer:** Flutter Widgets (`Screens`, `Widgets`) and Riverpod `Notifiers` for state management.
*   **Domain Layer:** Pure Dart classes defining `Models` and business logic entities.
*   **Data Layer:** `Repositories` that handle data fetching from the API (`Dio`) or local database (`Isar`).

### Visual Physics & Magic Layer
*   **Light Engine:** Time-of-day aware lighting provider (`LightEngine`) that tints the UI (Safe Day, Energetic Noon, Calm Night).
*   **Motion Semantics:** `StudioMotionProfile` defines physics-based curves (bouncy vs. cinematic) per studio.
*   **Cultural Intelligence:** `FestivalConfig` overrides themes based on the Indian calendar (e.g., Saffron/Gold for Diwali).
*   **Magical Feedback:** `MagicalLoadingOrb` (Breathing AI) and Haptic patterns (`lightImpact`, `mediumImpact`) for tactile assurance.

---

## 3. Feature Specifications (The "Sahayak Studio" Suite)

Each major feature is designed as a distinct "Studio" with a unique theme and optimized UX.

| Feature / Screen | Studio Theme | Key Capabilities |
| :--- | :--- | :--- |
| **Lesson Planner** | *The Wizard* (Orange) | • Voice Input for Topics<br>• Chip-based Grade Selection<br>• "Magic" Generation Flow<br>• Markdown Result View |
| **Quiz Generator** | *Game Master* (Green) | • "Difficulty Meter" (Bloom's Taxonomy)<br>• Question Type Cards (MCQ, T/F)<br>• Gamified Inputs |
| **Video Storyteller** | *Director's Cut* (Dark/Purple) | • Cinematic Input Interface<br>• Scene-by-scene Script Generation<br>• Export to PDF |
| **Visual Aid Creator** | *Art Studio* (Violet/Pink) | • Style Selector (Sketch, 3D, Diagram)<br>• AI Prompt Engineering<br>• Image Specification Cards |
| **Worksheet Wizard** | *The Notebook* (Grey/Paper) | • Paper-textured UI<br>• Vocabulary & Answer Key Toggles<br>• Printable Layouts |
| **Rubric Architect** | *The Grid* (Indigo) | • Structured Grading Scales<br>• Evaluation Criteria Chips<br>• Table-based Output |
| **Editor's Desk** | *Professional* (Slate) | • Templates for Emails, Circulars, & Notes<br>• Rich-text style editing<br>• Tone adjustment |
| **The Academy** | *Royal Blue* | • Teacher Training Modules<br>• Progress Tracking<br>• Interactive "Hero" Cards |
| **Community Hub** | *Social* (Warm) | • Instagram-style Content Feed<br>• Engagement (Likes, Comments)<br>• Resource Sharing |

---

## 4. User Flows

### A. The "Magic Creation" Flow (Standard for all tools)
1.  **Discovery:** User selects a tool from the Home Dashboard or "Tools" Grid.
2.  **Configuration (The Studio):**
    *   User enters a `Topic` (Voice or Text).
    *   User selects parameters (Grade, Style, Difficulty) via Chips/Sliders.
    *   **NO** typing long paragraphs; interactions are tap-heavy.
3.  **Generation:**
    *   App shows a distinct "Thinking..." animation.
    *   Request is sent to `ToolRepository`.
    *   Backend processes via Gemini/LLM.
4.  **Result & Action:**
    *   Content is rendered in rich Markdown.
    *   User can **Edit** (Regenerate), **Save** (to Library), or **Share** (PDF/Text).

### B. Offline Mode Flow
1.  **Detection:** App detects no internet connectivity.
2.  **Fallback:** `ToolRepository` switches to `DatabaseService`.
3.  **Access:** User can view previously generated and saved content from `My Library`.
4.  **Restriction:** New generation is disabled with a polite "Connect to Internet" nudge.

---

## 5. Technical Stack

*   **Framework:** Flutter (Mobile - iOS/Android)
*   **State Management:** Riverpod 2.0 (Generator/Hook patterns)
*   **Database:** Isar (NoSQL, Offline-first)
*   **Networking:** Dio (HTTP Client)
*   **AI Backend:** Genkit / Gemini 1.5 Pro
*   **Rendering:** `flutter_markdown_plus` for rich text
*   **Design System:** "Saffron" Tokenized System (JSON Loader + ThemeExtensions)
*   **Fonts:** Google Fonts: Outfit (Indic/Headings) & Inter (Body)

## 6. Current Status & Roadmap

### ✅ Completed
*   **Core Infrastructure:** App scaffolding, Navigation, Theme, Database, API Client.
*   **UX Redesign (Phase 1-6):** All 9 major screens have been redesigned to "Premium" standards.
*   **Voice Integration:** Global voice input implemented across creation tools.
*   **UX Redesign (Phase 1-6):** All 9 major screens have been redesigned to "Premium" standards.
*   **Voice Integration:** Global voice input implemented across creation tools.
*   **Community Features:** Feed and Training screens operational.
*   **Visual Physics Layer:** Time-aware lighting, Motion Semantics, and Glassmorphism optimizations implemented.
*   **Cultural Intelligence:** Festival Theming Framework active (Diwali, Holi, Pongal).
*   **"Magic" & Tactile:** Breathing AI Orb, Haptic Feedback, and Dynamic Motion profiles.

### 🚧 In Progress / Next Steps
*   **Production Hardening:**
    *   [ ] Comprehensive Error Handling (Global Error Boundary).
    *   [ ] User Manual & Onboarding Tour.
    *   [ ] Final Performance Profiling (ListView scrolling).
*   **Launch:**
    *   [ ] App Store / Play Store Submission Prep.
