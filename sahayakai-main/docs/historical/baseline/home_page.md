# Baseline Capture: Home Page

**Screen**: `src/app/page.tsx`
**Date**: Dec 15, 2025

## 1. Current State Description
The Home page serves as the entry point and primary tool interface. It contains:
-   **Hero Section**: Greeting ("Namaste, Teacher"), Value Prop ("AI-Powered Teaching Assistant").
-   **Main Input**: A large card with `AutoCompleteInput` and `MicrophoneInput`.
-   **Quick Actions**: A grid of 4 cards (Lesson Plan, Quiz, Content, Training) leading to sub-routes.

## 2. Issues & Friction (Observed)
-   **Heavy Visuals**: The `QuickActionCard` has a `hover:-translate-y-1` effect which is nice on desktop but useless on touch. The "Start Creating ->" text appears only on hover, making the cards feel "dead" on mobile until tapped.
-   **Input Ambiguity**: The main input says "What would you like to teach?". It functions as a "Quick Lesson Plan" generator, but this isn't explicitly clear vs a "Global Search".
-   **Spacing**: `min-h-[80vh]` and `gap-12` might be too sparse for a mobile-first user who wants to get to the tools quickly.
-   **Typography**: The "Try asking..." helper text is minimal (`text-slate-400`), potentially hard to read for low-vision users.

## 3. "Heavy" Elements
-   **Backdrop Blur**: `backdrop-blur-xl` is used. On low-end Android devices (common in rural India), this is computationally expensive and can cause scroll lag.
-   **Animations**: Start-up animations (`animate-in`) delay interactivity by ~700ms.

## 4. Goals for this Unit
-   Make "Quick Actions" clickable/obvious on mobile (always show "Start").
-   Clarify the Main Input's purpose.
-   Reduce "Backdrop Blur" for performance.
-   Ensure "Rate Limiting" protects this public entry point.
