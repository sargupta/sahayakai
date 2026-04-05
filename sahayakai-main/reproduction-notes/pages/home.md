# Home Page — /

**File:** `src/app/page.tsx`
**Auth:** Not required (public page, but features prompt sign-in)

---

## Purpose

Landing and launch pad. Greets teacher by name, provides a mic input for voice commands to VIDYA assistant, and displays quick-action cards for all AI tools.

---

## Component Tree

```
page.tsx (Home)
├── Greeting section (personalized if signed in)
├── MicrophoneInput — voice command entry to VIDYA
└── Quick action cards grid
    ├── Link → /lesson-plan       (Lesson Plan)
    ├── Link → /quiz-generator    (Quiz Generator)
    ├── Link → /worksheet-wizard  (Worksheet Wizard)
    ├── Link → /instant-answer    (Instant Answer)
    ├── Link → /visual-aid-designer (Visual Aid Designer)
    ├── Link → /rubric-generator  (Rubric Generator)
    ├── Link → /teacher-training  (Teacher Training)
    ├── Link → /video-storyteller (Video Storyteller)
    ├── Link → /virtual-field-trip (Virtual Field Trip)
    └── Link → /content-creator  (Content Creator)
```

---

## State

- `user` from `useAuth()` — personalized greeting
- MicrophoneInput manages its own recording state internally

---

## Key Interactions

- **Mic button** — activates MicrophoneInput, VAD-based recording, transcript sent to `/api/assistant` which routes to appropriate tool via `agent-router`
- **Quick action cards** — navigate to tool pages
- Clicking any card while unauthenticated shows auth modal (`requireAuth()`)

---

## Design

- Page header: "Good morning/afternoon, [Name]" or generic greeting
- Mic input: prominent, centered, with status animation (greeting → recording → processing)
- Cards: grid layout, each with tool icon (Lucide), title, brief description
- Card colors match tool type (orange for lesson plan, blue for quiz, etc.)
- Fully responsive — 2-col grid on mobile, 3-col on larger screens

---

## Voice Features

`MicrophoneInput` component:
- VAD (Voice Activity Detection) — auto-stops on silence
- Fallback: Web Speech API if VAD unavailable
- Status ring animation (pulsing while recording)
- Transcript → VIDYA `/api/assistant` → intent classification → redirects to tool page with params pre-filled

---

## Dependencies

- `useAuth()` context hook
- `MicrophoneInput` component (`src/components/microphone-input.tsx`)
- Next.js `Link` for card navigation
