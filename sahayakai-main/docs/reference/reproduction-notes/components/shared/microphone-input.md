# MicrophoneInput Component

**File:** `src/components/microphone-input.tsx`

_Last verified against source: 2026-06-10. (Lives directly under `src/components/`, not a `shared/` subfolder.)_

---

## Purpose

Voice input button used on AI tool pages and the home page. Records audio, transcribes via the Web Speech API first and a cloud fallback (`/api/ai/voice-to-text`) second, and streams the transcript back to the caller.

---

## Props (verify against source)

The primary callback is `onTranscriptChange` (a transcript callback), not `onTranscript`. TODO(verify: full current prop list - confirm `onTranscriptChange`, any auto-submit prop, language prop, and disabled prop against the live signature).

---

## State Machine

`MicStatus = 'idle' | 'greeting' | 'initializing' | 'recording' | 'processing'`

A spoken/visual greeting state precedes recording; `initializing` covers mic permission + stream setup.

---

## Two Recognition Paths

### Path 1: Web Speech API (tried first, free, zero latency)
- `window.SpeechRecognition || window.webkitSpeechRecognition`
- Not available on Firefox - falls through to Path 2.

### Path 2: MediaRecorder + `/api/ai/voice-to-text` (cloud fallback)
- Server pipeline is Sarvam with a Gemini fallback.
- Frequency-domain VAD: analyses the 300–3000 Hz band with `SPEECH_THRESHOLD = 25` to gate speech vs silence and auto-stop.
- MIME negotiation prefers `audio/ogg;codecs=opus`, falling back to `audio/webm;codecs=opus`.
- `MIN_AUDIO_BYTES = 2000` - clips below this are discarded as empty.
- Includes a refusal-detection guard on the transcript result.

---

## Visual States

Mic icon with a live waveform during recording and a `Loader2` during `processing`. Colors use theme tokens / accents rather than hardcoded orange.

---

## Usage in Pages

Typically positioned absolute inside an input container (right side); the transcript callback writes into the page's prompt/topic state.

TODO(verify: exact auto-submit behaviour and prop name in current source).
