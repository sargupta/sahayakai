# OmniOrb Component (VIDYA Assistant)

**File:** `src/components/omni-orb.tsx`

_Last verified against source: 2026-06-10. (Lives directly under `src/components/`, not a `layout/` subfolder.)_

---

## Purpose

Floating mic orb - the VIDYA AI assistant. Draggable, persistent across pages. Tap to talk; transcript plus context POSTs to `/api/assistant`; the response is spoken and can drive in-app navigation/form-fill and compound multi-step actions.

---

## Props

None - standalone. State is held in a Zustand store (`useJarvisStore`), not local React state.

---

## State (via `useJarvisStore`)

Orb open/recording/processing/speaking state, drag position, messages, and VIDYA profile/session sync all flow through the store. Voice capture is delegated to a child `MicrophoneInput`.

---

## Request Flow

```
1. Tap orb -> MicrophoneInput captures + transcribes (Web Speech first, cloud fallback)
2. POST /api/assistant with:
   { message, chatHistory, currentScreenContext, teacherProfile, detectedLanguage, uiLanguage }
3. Streamed response -> rendered progressively + spoken via TTS
4. Compound intents surface as action chips
```

---

## Agent Actions / Compound Intents

- Multi-step intents are tracked as `pendingActions`, matched against `KNOWN_FLOWS`, and labelled via `FLOW_LABEL` chips the user can confirm/run.
- Navigation + form pre-fill into tool pages is supported.
- A language-poisoning guard prevents a stray detected language from corrupting subsequent turns.

---

## Cross-Device Memory

- VIDYA profile/session synced to Firestore (the `vidya` memory surface) for cross-device continuity (see `/api/vidya/profile` and `/api/vidya/session`).
- A `BrainCircuit` icon opens the memory drawer.

---

## Visibility Rules

- Draggable via pointer events.
- Auto-hides on scroll.
- Excluded on routes `["/onboarding", "/"]`.
- Hidden while `voiceDialogOpen` (e.g. a full voice dialog is active).

---

## Dependencies

- `useJarvisStore` (Zustand) - orb + VIDYA state
- `MicrophoneInput` - voice capture/transcription child
- `/api/assistant` - streaming assistant endpoint
- `/api/vidya/profile`, `/api/vidya/session` - cross-device memory
- TTS for spoken responses

TODO(verify: exact list of `KNOWN_FLOWS` / `FLOW_LABEL` entries and the precise `useJarvisStore` field names).
