# PART A — SAHAYAK DESIGN SYSTEM PRD

*(World-Class, Bharat-First, Localisation-Native, Studio-Based)*

## 1. Design System Objective

Create a **Tokenised, Studio-Themed, Locale-Adaptive Design System** that:

1. Feels global (Material You, Apple HIG parity, WCAG 2.2)
2. Feels local (Indic scripts, pedagogy metaphors, cultural color semantics)
3. Supports Studio differentiation without fragmenting code
4. Is Remote-Config driven and Server-UI ready
5. Scales across:

   * Languages (EN, HI, TA, TE, MR, BN, etc.)
   * Literacy levels
   * Low-end devices
   * Offline-first constraints

---

## 2. Design Pillars

### 2.1 Bharat-First Internationalisation

* Devanagari-first typography scaling
* Vernacular voice-first UI
* Low cognitive load
* Classroom metaphor-based interaction
* Color psychology aligned to Indian semiotics

### 2.2 Studio Identity System

Each feature = Visual Persona + Motion Personality + Interaction Grammar

| Studio       | Token Overlay   | Motion Style     | Density  |
| ------------ | --------------- | ---------------- | -------- |
| Wizard       | Saffron / Amber | Magical ease-out | Medium   |
| Game Master  | Green           | Springy, playful | Compact  |
| Director     | Purple / Dark   | Cinematic slow   | Spacious |
| Art Studio   | Pink / Violet   | Organic          | Medium   |
| Notebook     | Paper Grey      | Minimal          | Dense    |
| Grid         | Indigo          | Precise          | Dense    |
| Professional | Slate           | Subtle           | Medium   |
| Academy      | Royal Blue      | Motivational     | Medium   |
| Community    | Warm Gradient   | Social bounce    | Compact  |

---

## 3. Token Architecture (Flutter Native)

### 3.1 Token Layers

```
Base Tokens (Material 3)
   ↓
Brand Tokens (Saffron Core)
   ↓
Studio Tokens (Per Feature)
   ↓
Locale Tokens (Script, Density, Direction)
   ↓
Festival / Event Tokens (Remote Config)
   ↓
Accessibility Tokens
```

### 3.2 Token Categories

| Category   | Examples                                        |
| ---------- | ----------------------------------------------- |
| Color      | primary, surface, saffronAccent, studioOverlay  |
| Typography | latinFont, indicFont, arabicFont, headlineScale |
| Spacing    | grid8, grid12, grid16, classroomDensity         |
| Motion     | thinkAnimationCurve, successBounce              |
| Shape      | cardRadius, sheetRadius                         |
| Elevation  | boardLevel, modalLevel                          |
| Semantic   | success, warning, magical, social               |
| Locale     | textDirection, numeralSystem                    |

All tokens must support:

* JSON override
* Remote Config override
* ThemeExtension binding

---

## 4. Atomic → Molecular → Studio Organisms

### 4.1 Atoms

* Voice Mic Button
* Chip
* Slider
* Script-aware Text
* AI Thinking Loader
* Offline Banner
* Consent Sheet
* Festival Badge

### 4.2 Molecules

* Topic Input Bar (Voice + Text)
* Grade Selector
* Difficulty Meter
* Style Picker
* Output Card
* Action Bar (Edit, Save, Share)

### 4.3 Organisms

* Studio Shell
* Magic Generation Flow
* Result Workspace
* Library Grid
* Training Module Player
* Community Feed Card

---

## 5. Motion System (Cultural Semantics)

| Context     | Motion Rule                                     |
| ----------- | ----------------------------------------------- |
| AI Thinking | Breathing gradient + subtle pulse               |
| Success     | Gentle sparkle (Wizard), Confetti (Game Master) |
| Error       | Calm shake, no red flash                        |
| Voice       | Ripple waveform, not robotic bars               |

Locale-aware easing:

* India: Ease-in-out, calm
* US: Fast spring
* Japan: Precision cubic

---

## 6. Accessibility & Inclusion

* Font scaling per script
* Dyslexia-friendly mode
* High contrast chalkboard mode
* Reduced motion mode
* Voice-only flow support
* Offline-first UX

---

## 7. Governance

* Token versioning (v1, v2…)
* Figma ↔ Flutter sync
* Studio approval board
* Language QA workflow
* Pedagogy review loop

---

# PART B — FLUTTER IMPLEMENTATION STACK (Mapped to Your Codebase)

## 1. Core Architecture Alignment

Your existing stack already fits an **Enterprise-Grade Global App** model.

| Layer   | Your Stack           | Enhancement                          |
| ------- | -------------------- | ------------------------------------ |
| UI      | Flutter + Material 3 | Add Server Driven UI Renderer        |
| State   | Riverpod 2.0         | Add Locale & Theme Providers         |
| Data    | Isar                 | Add Token Cache + Translation Memory |
| Network | Dio                  | Add Edge CDN + Retry Policies        |
| AI      | Genkit / Gemini      | Add Prompt Localisation Layer        |

---

## 2. Design System Implementation

### 2.1 Token Engine

```
lib/src/core/theme/
 ├── tokens/
 │   ├── base_tokens.json
 │   ├── saffron_tokens.json
 │   ├── studio_wizard.json
 │   ├── studio_director.json
 │   ├── locale_hi.json
 │   ├── festival_diwali.json
 │
 ├── theme_extensions/
 ├── typography/
 ├── motion/
 └── studio_resolver.dart
```

Use:

* `ThemeExtension<T>`
* `Riverpod Provider<ThemeConfig>`
* Firebase Remote Config overrides

---

## 3. Internationalisation Stack

| Capability   | Flutter Implementation                 |
| ------------ | -------------------------------------- |
| ICU          | intl + ARB                             |
| Script Fonts | GoogleFonts + fallback chain           |
| RTL          | Directionality + EdgeInsetsDirectional |
| Voice        | Speech-to-text locale routing          |
| Numbers      | NumberFormat with Indian grouping      |
| Dates        | Locale-aware calendars                 |

Add:

* Language quality fallback
* On-device translation cache

---

## 4. Studio Runtime Engine

Each Studio loads:

```dart
StudioConfig(
  theme: WizardThemeTokens,
  motion: WizardMotionProfile,
  density: WizardLayoutDensity,
  voiceTone: WizardVoiceProfile,
)
```

Bound via:

* `StudioProvider`
* `StudioShell` widget

---

## 5. Server Driven UI (Phase 2)

For Community, Academy, Campaigns:

* JSON Layout
* Widget Registry
* Remote Config gated rollout

---

## 6. Performance & Offline Optimisation

* Impeller
* Image CDN + WebP
* Rive vector animations
* Isar prefetch
* Lazy markdown rendering
* Feature-level code splitting

---

## 7. Security & Compliance

* DPDP Act India consent module
* Teacher data encryption
* Child-safe content filters
* Classroom mode (no social distractions)

---

## Strategic Positioning for Investors / Google / Play Store

> SahayakAI implements a Tokenised, Studio-Based, Locale-Intelligent Design System on Flutter, combining Material You adaptive theming, Bharat-first pedagogy metaphors, Server-Driven UI extensibility, and AI-native interaction patterns, enabling a single global codebase to deliver culturally personalised teacher experiences across India and international markets.
