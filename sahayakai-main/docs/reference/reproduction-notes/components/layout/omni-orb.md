# OmniOrb Component (VIDYA Assistant)

**File:** `src/components/omni-orb.tsx`

---

## Purpose

Floating mic orb — the VIDYA AI assistant interface. Draggable, persistent across all pages. Activates with tap/click, listens for voice, sends to `/api/assistant`, speaks response via TTS, shows chat history in a drawer.

---

## Props

None — standalone, reads auth from `useAuth()`.

---

## Key Features

1. **Floating positioning** — fixed, draggable (mouse/touch drag to reposition)
2. **Voice activation** — tap orb → start recording (VAD-based, auto-stops on silence)
3. **Streaming response** — `/api/assistant` returns SSE stream, text typed out progressively
4. **TTS playback** — assistant response spoken via `tts.speak()`
5. **Memory drawer** — tap history icon → Sheet drawer showing full conversation history
6. **Profile sync** — learns teacher's grade/subject/language preferences from NAVIGATE_AND_FILL intents
7. **Form pre-fill** — agent-router routes to tool page AND pre-fills form via URL params

---

## Internal State

| State | Type | Purpose |
|---|---|---|
| `isOpen` | `boolean` | Drawer open |
| `recording` | `boolean` | Mic active |
| `processing` | `boolean` | Waiting for response |
| `speaking` | `boolean` | TTS playing |
| `messages` | `Message[]` | Chat history (in-memory) |
| `position` | `{x, y}` | Draggable position |
| `profile` | `object` | Cached teacher preferences |

---

## Request Flow

```
1. User taps orb → startRecording()
2. VAD detects silence → stopRecording() → audio blob
3. POST /api/ai/voice-to-text → transcript
4. POST /api/assistant with { message: transcript, userId, context: profile }
5. Stream chunks received → append to message bubble
6. Stream complete → tts.speak(fullResponse)
7. TTS finishes → orb returns to idle state
```

---

## Agent Actions

The assistant can take actions beyond chat:
- `NAVIGATE_AND_FILL` → navigate to tool page + pre-fill form via URL params
- `SHOW_LIBRARY` → navigate to `/my-library`
- `CHAT_RESPONSE` → just respond with text

Profile learning: when teacher specifies grade/subject/language in conversation, saved to Firestore `users/{uid}` for future pre-fills.

---

## Draggable Behavior

- `onMouseDown` / `onTouchStart` → capture drag start position
- `onMouseMove` / `onTouchMove` → update position
- `onMouseUp` / `onTouchEnd` → release
- Position saved to localStorage for persistence across page navigations

---

## Visual States

| State | Visual |
|---|---|
| Idle | Orange orb, subtle pulse animation |
| Recording | Red orb, larger pulse |
| Processing | Orange orb, spinning animation |
| Speaking | Orange orb, waveform animation |

---

## Memory Drawer

- Triggered by history icon (`Clock` Lucide) on orb
- `Sheet` component sliding from right
- Shows last N messages (user + assistant)
- Clear history button
- Conversation stored in-memory (not persisted to Firestore)

---

## Dependencies

- `tts.ts` — for speaking responses
- `/api/assistant` — streaming endpoint
- `/api/ai/voice-to-text` — transcription
- `useAuth()` — user identity
- `agent-router.ts` (called server-side in `/api/assistant`)
