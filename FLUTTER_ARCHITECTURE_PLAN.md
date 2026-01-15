# SahayakAI: Flutter Mobile Application Plan

## 1. Executive Summary
This document outlines the technical architecture, component breakdown, data modeling, and pipelines required to build the SahayakAI mobile application using Flutter. The primary goal is to provide an **Offline-First**, **Performance-Optimized**, and **Cross-Platform** experience for rural teachers.

---

## 2. Tech Stack

### **Framework & Core**
*   **Framework:** Flutter (Latest Stable)
*   **Language:** Dart
*   **Architecture:** Clean Architecture + Feature-First (Riverpod)

### **Key Dependencies**
*   **State Management:** `flutter_riverpod` (Compile-safe, testable state)
*   **Navigation:** `go_router` (Deep linking support, declarative)
*   **Local Database (Offline):** `isar` (NoSQL, fast, great for arbitrary JSON data like lesson plans)
*   **Networking:** `dio` (Robust HTTP client with interceptors)
*   **Audio Recording:** `flutter_sound` or `record` (For voice input)
*   **Backend/Auth:** `firebase_core`, `firebase_auth` (Syncs with existing web auth)
*   **UI Components:** `flutter_animate` (Micro-interactions), `google_fonts` (Typography)

---

## 3. Component Breakdown & Porting Strategy

The app will be divided into modular features to ensure scalability. We will map existing React components to Flutter widgets.

### **A. Core Layer (`lib/src/core`)**
*   **Network Client:** Dio instance with robust error handling (retries for poor connection).
*   **Offline Sync Engine:** Background service to cache requests when offline and push them when online (`workmanager`).
*   **Localization:** `flutter_localizations` for 10+ Indian languages (Hindi, Tamil, Marathi, etc.).

### **B. Feature Modules (Mapping from `sahayakai-replica`)**

| Feature | React Component (`sahayakai-replica`) | Flutter Widget Strategy | Priority |
| :--- | :--- | :--- | :--- |
| **Lesson Plan Input** | `src/components/lesson-plan/lesson-plan-input-section.tsx` | `LessonPlanForm` (Custom `Form` with `TextFormField` & `DropdownButton`) | 🔴 Critical |
| **Voice Input** | `src/components/microphone-input.tsx` | `VoiceInputWidget` (Using `flutter_sound` + Waveform animation) | 🔴 Critical |
| **Lesson Display** | `src/components/lesson-plan-display.tsx` | `MarkdownViewer` (Using `flutter_markdown`) | 🔴 Critical |
| **History/Library** | `src/app/my-library/page.tsx` | `LibraryScreen` (ListView with `isar` data source) | 🟠 High |
| **Quiz Generator** | `src/components/quiz-display.tsx` | `QuizCard` (interactive stateful widget) | 🟡 Medium |
| **Language Selector** | `src/components/language-selector.tsx` | `LanguageDropdown` (Reusable widget) | 🟡 Medium |

### **C. Backend Requirements (Critical for Mobile)**
Since the current web app uses Next.js Server Actions (which are internal), the mobile app cannot call them directly.
*   **Task:** Create a new API route in `sahayakai-replica` at `src/app/api/v1/generate-lesson-plan/route.ts`.
*   **Logic:** This route will accept JSON input, call the existing `generateLessonPlan` flow, and return the JSON response.
*   **Auth:** Must verify Firebase ID Token from the request header.

---

## 4. Role Assignments

To ensure efficient execution, tasks are distributed by role:

### **Role 1: The Architect (Core & Data)**
*   **Responsibility:** Setup project skeleton, data layer, offline sync, and state management.
*   **Tasks:**
    *   Initialize `sahayakai_mobile` project.
    *   Setup `riverpod` providers.
    *   Implement `Isar` database schemas (`LessonPlan`, `User`).
    *   Configure `Dio` interceptors for auth and error handling.

### **Role 2: The UI Specialist (Components & Design)**
*   **Responsibility:** Port React components to Flutter widgets, ensure responsive design and animations.
*   **Tasks:**
    *   Build `LessonPlanForm` UI (replicating the 8:4 grid logic where applicable).
    *   Create `VoiceInputWidget` with animations.
    *   Implement `MarkdownViewer` with custom styling for headers and lists.
    *   Ensure "Glassmorphism" design language is maintained (using `BackdropFilter`).

### **Role 3: The Integrator (Features & Logic)**
*   **Responsibility:** Connect UI to logic, handle form submissions, and manage navigation.
*   **Tasks:**
    *   Implement `go_router` navigation graph.
    *   Connect `VoiceInputWidget` to Speech-to-Text API.
    *   Wire up `LessonPlanForm` to the backend generation API.
    *   Implement the "Offline First" fallback logic.

---

## 5. Data Modeling & Processing

### **A. Input Data Model (Request)**
What the user sends to generate content.
```dart
class GenerationRequest {
  final String topic;          // "Photosynthesis"
  final String subTopic;       // "Process in plants"
  final String gradeLevel;     // "Class 7"
  final String language;       // "hi" (Hindi)
  final String complexity;     // "Basic", "Advanced"
  final List<String> resources;// ["Blackboard", "Chalk"]
  final bool forceOffline;     // If true, attempt local generation/template
}
```

### **B. Output Data Model (Response)**
What the app receives and renders.
```dart
class LessonPlan {
  final String id;
  final String contentMarkdown; // Full plan in MD
  final Map<String, dynamic> metadata; // Tags, timestamps
  final bool isSynced;          // Sync status flag
  
  // JSON Serialization logic...
}
```

### **C. Data Flow Strategy**
1.  **User Input:** Teacher speaks "Teach photosynthesis for Class 7".
2.  **Logic Layer:**
    *   Check Connectivity.
    *   *If Online:* Send to Genkit Backend -> Stream Response -> Save to Local DB -> Update UI.
    *   *If Offline:* Query Local Template Database -> Fill variables -> Show "Offline Draft" -> Queue for Sync.

---

## 6. Pipelines & Workflows

### **A. Development Pipeline**
*   **Setup:** `fvm` (Flutter Version Management) to enforce consistent engine version.
*   **Linting:** `flutter_lints` (Strict rules).
*   **Code Gen:** `build_runner` for generating JSON parsers (freezed/json_serializable).

### **B. Testing Pipeline**
*   **Unit Tests:** Test logic classes (e.g., "Does offline mode return a template?").
    *   Command: `flutter test`
*   **Widget Tests:** Test UI components (e.g., "Does the button show a spinner when loading?").
    *   Command: `flutter test_widget`
*   **Integration Tests:** Full flow run (Login -> Generate -> Save).
    *   Command: `flutter drive`

### **C. Deployment Pipeline (Planned)**
*   **Tool:** Fastlane
*   **Android:**
    *   Build App Bundle (`.aab`).
    *   Upload to Google Play Console (Internal Testing Track).
*   **iOS:**
    *   Build Archive (`.ipa`).
    *   Upload to TestFlight.

---

## 7. Required Resources & Next Steps
To proceed, we need:
1.  **Flutter SDK:** Installed locally.
2.  **Android Studio / Xcode:** For simulators.
3.  **Firebase Config files:** `google-services.json` (Android) / `GoogleService-Info.plist` (iOS) - *We can reuse your existing web project credentials.*

### **Immediate Task List**
1.  Initialize Flutter project: `flutter create sahayakai_mobile`.
2.  Setup folder structure (`core`, `features`, `data`).
3.  Install dependencies (`riverpod`, `dio`, `isar`).
