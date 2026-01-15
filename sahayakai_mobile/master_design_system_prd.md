# SahayakAI "Saffron" Design System: Master Technical PRD
**Version:** 2.0 (Stakeholder Ready)
**Date:** 2026-01-15
**Status:** In Development
**Authors:** Architecture & Design Team

---

## 1. Executive Summary

SahayakAI is not just a utility app; it is a **digital companion** for rural Indian educators. The "Saffron" Design System is the architectural embodiment of this philosophy, designed to bridge the gap between advanced AI capabilities and the cultural, infrastructural realities of Bharat.

This PRD outlines a world-class, "Bharat-First" design system that leverages:
*   **Tokenized Architecture:** For infinite scalability across Studios and Themes.
*   **Visual Physics:** Glassmorphism and Light Engines for a premium, tangible feel.
*   **Cultural Intelligence:** Deeply integrated regional and festival sensitivity.
*   **Platform Excellence:** Strict adherence to Google UX, Accessibility, and Performance standards.

**Strategic Goal:** To create an application that feels *magical* to a rural teacher, blending the warmth of Indian tradition with the precision of Silicon Valley engineering.

---

## 2. Product Vision & UX North Star

### 2.1 The "Sahayak" Philosophy
Our UX North Star is the concept of a **"Wise, Helpful Companion" (Sahayak)**.
*   **Trust:** The UI must never feel alien or intimidating. It uses familiar metaphors (Notebooks, Classrooms, Festivals).
*   **Calm AI:** The interface manages cognitive load aggressively. AI does the heavy lifting; the UI remains serene.
*   **Respect:** The system honors the user's context—low bandwidth, older devices, and diverse languages.

### 2.2 Design Principles
1.  **Bharat-First:** Not consistent with Material Design, but consistent with *India*. Warmer colors, softer curves, Indic typography.
2.  **Cognitive Load Control:** Every screen has one primary job. Complexity is progressively disclosed.
3.  **Tangible Magic:** UI elements react like real-world objects (glass, paper, light) to build intuitive understanding.
4.  **Performance as a Feature:** Beauty must not come at component cost. All visual effects degrade gracefully.

---

## 3. System Architecture

The Saffron system is built on a layered architecture to ensure maintainability and scalability.

### 3.1 Token Layer (The "DNA")
We use a 3-tier token structure, managed via JSON and `SahayakTheme` extensions.

*   **Tier 1: Base Tokens:** Raw values (e.g., `#FF7A00`, `Inter`, `8px`). Agnostic of context.
*   **Tier 2: Semantic Tokens:** Usage-based (e.g., `primary.action`, `text.body`, `surface.card`).
*   **Tier 3: Component Tokens:** Specific mapping (e.g., `button.primary.bg`, `card.elevation`).

### 3.2 Studio Architecture (The "Context")
The app is divided into functional "Studios," each with a distinct visual identity but shared structure.

| Studio | Metaphor | Purpose | Key Color | Motion Profile |
| :--- | :--- | :--- | :--- | :--- |
| **Wizard** | Magic | Creation (Lesson Plans) | Saffron | `easeOutCubic` |
| **Director** | Cinema | Media (Video/Audio) | Plum | `easeInOutCubicEmphasized` |
| **Notebook** | Academic | Documentation | Slate | `standard` |
| **Community** | Sangha | Social Sharing | Orange | `standard` |

### 3.3 The StudioShell
The `StudioScaffold` is the master container that enforces consistency. It automatically handles:
*   **Theming:** Injects the correct token set.
*   **Motion:** Applies studio-specific transitions.
*   **Connectivity:** Shows offline banners.
*   **AI State:** Manages the "Thinking" glass overlay.
*   **Accessibility:** Clamps text scaling.

---

## 4. Visual Physics Layer (Deliverable #4 & Future)

We move beyond flat UI to a system based on light and material.

### 4.1 Glassmorphism Engine
Glass is used accentually to create depth and focus. It is **not** a theme, but an interaction layer.

*   **Implementation:** `GlassContainer` widget.
*   **Optical Model:**
    *   **Background Blur:** Variable radius (12px - 40px).
    *   **Tint:** Studio-aware color wash (10-18% opacity).
    *   **Noise:** Subtle grain to prevent banding on low-bit screens.
    *   **Border:** High-opacity white stroke (20-30%) for definition.
*   **Performance:**
    *   High-End: Real-time blur (`BackdropFilter`).
    *   Low-End: Fallback to opaque, tinted surfaces.

### 4.2 Light Engine (Proposed)
A physically-inspired lighting model to bring scenes to life.
*   **Global Light Source:** Imaginary light source at top-left (10:00 AM sun).
*   **Shadows:** Cast shadows follow this source, creating consistent depth.
*   **Focus Bloom:** Active elements gently glow (e.g., Mic button).
*   **Time-of-Day:** Theme adapts to local time (Morning warm, Noon bright, Evening cool).

---

## 5. Cultural & Festival Intelligence (Phase 3)

The UI is a living entity that celebrates with the user.

### 5.1 Festival Theming Framework
Dynamic overlays that activate during key Indian festivals.
*   **Mechanism:** Server-driven config triggers a "Festival Mode."
*   **Assets:**
    *   **Diwali:** Warm light, diyas, gold accents.
    *   **Holi:** Vivid color splashes, playful motion.
    *   **Independence Day:** Tricolor gradients, disciplined typography.
*   **Governance:** "Respectful Symbolism." No caricatures. Subtlety is key.

### 5.2 Regional Adaptation
*   **Language:** UI layout adapts to script density (e.g., Tamil needs more vertical space).
*   **Iconography:** Regionally appropriate metaphors (e.g., 'Namaste' vs 'Handshake').

---

## 6. Platform & Store Readiness

We align strictly with Google Play and Apple App Store standards.

### 6.1 Google UX Alignment
*   **Material You:** We respect system preferences where possible, blending them with Saffron identity.
*   **Large Screens:** `StudioScaffold` is responsive-ready for Tablets and Foldables.

### 6.2 Accessibility (A11y)
*   **WCAG 2.2:** Target AA compliance.
*   **TalkBack:** All interactive elements have semantic labels.
*   **Color Blindness:** Information never conveyed by color alone.
*   **Cognitive:** "Calm Mode" toggles to reduce motion and visual noise.

### 6.3 Performance Vitals
*   **Startup:** < 2s to interactive.
*   **Jank:** 99% frames < 16ms.
*   **Memory:** Aggressive disposal of heavy assets (videos/images) in `StudioScaffold`.

---

## 7. Rollout Plan

*   **Phase 1 (Done):** Foundation, Tokens, StudioScaffold, Glass Engine.
*   **Phase 2 (Current):** Pilot Migration (Lesson Planner).
*   **Phase 3:** Core Features Migration (Quiz, Video).
*   **Phase 4:** Light Engine & Festival Systems.
*   **Phase 5:** Formal A11y & Performance Audit.

---

## 8. Governance & Versioning
*   **Design System Owner:** Leads Design & Eng.
*   **Versioning:** Semantic Versioning (e.g., Saffron 2.1.0).
*   **Breaking Changes:** Must be approved by Review Board.
