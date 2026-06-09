# Baseline Capture: Lesson Plan Input Flow

**Screen**: `src/app/lesson-plan/page.tsx` (and components)
**Date**: Dec 15, 2025

## 1. Current State Description
The Lesson Plan creation flow is a split view on Desktop (7:5 grid) and a stacked view on Mobile.
-   **Left/Top**: Input Section (Topic, Mic, Image, Templates).
-   **Right/Bottom**: Sidebar (Grade, Language, Resource Level, Difficulty, Chapter).
-   **Bottom**: "Generate Lesson Plan" Primary CTA.

## 2. Issues & Friction (Observed)
-   **Mobile "Scroll Wall"**: On mobile, the `LessonPlanSidebar` renders *between* the Input and the "Generate" button.
    -   User Flow: Type Topic -> Scroll past Grade -> Scroll past Language -> Scroll past Resources -> Scroll past Difficulty -> Scroll past Chapter -> **Finally click Generate**.
    -   Impact: High friction for the "Happy Path" (just entering a topic).
-   **Cognitive Overload**: The Sidebar exposes "Resources" (Low/Medium/High) and "Difficulty" (Basic/Standard/Advanced) by default. These are rarely changed by a hurried teacher, adding visual noise.
-   **Visual Hierarchy**: The "Quick Start Templates" in the Input Section compete with the Quote/Greeting in prominence.

## 3. Goals for this Unit
-   **Fix Mobile CTA**: Move the "Generate" button *immediately after* the Input Section on mobile (or logically place it before the settings).
-   **Hide Advanced Settings**: Collapse "Resource Level" and "Difficulty" into an "Advanced Settings" toggle.
-   **Simplify Sidebar**: Keep only "Grade" and "Language" visible by default.
