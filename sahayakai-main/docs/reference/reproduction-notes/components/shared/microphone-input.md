# MicrophoneInput Component

**File:** `src/components/microphone-input.tsx`

---

## Purpose

Voice input button used on AI tool pages and the home page. Records audio, transcribes via Web Speech API or `/api/ai/voice-to-text`, fills a text input, optionally auto-submits.

---

## Props

```ts
{
  onTranscript: (text: string) => void;
  onAutoSubmit?: () => void;    // called after transcript if provided
  language?: string;            // BCP-47 lang code for SpeechRecognition
  disabled?: boolean;
}
```

---

## State Machine

```
greeting → recording → processing → done → greeting (loop)
                     ↘ idle (on cancel/error)
```

---

## Two Recognition Paths

### Path 1: Web Speech API (preferred, zero latency)
- `window.SpeechRecognition || window.webkitSpeechRecognition`
- `recognition.lang = language || navigator.language`
- `recognition.continuous = false`, `recognition.interimResults = false`
- `recognition.onresult → onTranscript(result.transcript)`
- Not available on Firefox

### Path 2: MediaRecorder + /api/ai/voice-to-text (fallback)
- VAD (Voice Activity Detection) — auto-stops on silence (1.5s threshold)
- Records audio → Blob → POST to `/api/ai/voice-to-text`
- Response: `{ transcript: string }`
- Used when SpeechRecognition unavailable

---

## Visual States

| State | Visual |
|---|---|
| Greeting | Mic icon, subtle orange pulse ring |
| Recording | Red mic, larger pulse, elapsed timer |
| Processing | Loader2 spinner (orange) |
| Done | Check icon (green), brief flash |

---

## Auto-Submit

If `onAutoSubmit` prop provided: called automatically after transcript is set with a short debounce (to allow state update to propagate).

---

## Usage in Pages

```tsx
<div className="relative">
  <Input value={topic} onChange={...} />
  <MicrophoneInput
    onTranscript={(text) => setTopic(text)}
    onAutoSubmit={() => handleGenerate()}
    language={langToCode(language)}
  />
</div>
```

The MicrophoneInput is typically positioned absolute inside the input container (right side).
