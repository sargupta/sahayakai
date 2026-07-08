# VoiceRecorder Component

**File:** `src/components/messages/voice-recorder.tsx`

_Last verified against source: 2026-06-10._

---

## Purpose

In-chat voice message recorder. Press mic → record → stop/send or cancel → auto-uploads to Firebase Storage → passes URL + duration to parent.

---

## Props

```ts
interface VoiceRecorderProps {
  onSend: (audioUrl: string, duration: number) => void;
  disabled?: boolean;
}
```

---

## State Machine

```
idle → recording → uploading → idle (on success)
                 ↘ idle (on cancel)
```

---

## Internal State

| State | Type | Purpose |
|---|---|---|
| `state` | `'idle' \| 'recording' \| 'uploading'` | Current recorder state |
| `elapsed` | `number` | Recording seconds elapsed |

**Refs (not state - no re-render):**
- `mediaRecorderRef` - `MediaRecorder` instance
- `chunksRef` - `Blob[]` audio data chunks
- `timerRef` - `NodeJS.Timeout` for elapsed counter
- `startTimeRef` - `number` recording start timestamp

---

## Recording Flow

```
startRecording():
  1. navigator.mediaDevices.getUserMedia({ audio: true })
  2. Pick first supported MIME from candidate list (see below)
  3. new MediaRecorder(stream, { mimeType })
  4. recorder.ondataavailable → push to chunksRef
  5. recorder.onstop → uploadAudio()
  6. recorder.start(250)  // collect chunks every 250ms
  7. setState('recording'), start elapsed timer

stopRecording():
  1. stopTimer()
  2. mediaRecorder.requestData()  // flush any buffered final chunk before stop
  3. setState('uploading')
  4. mediaRecorder.stop() → triggers onstop → uploadAudio()

cancelRecording():
  1. stopTimer()
  2. Nullify ondataavailable + replace onstop (discard chunks)
  3. recorder.stop() - but onstop just stops stream tracks
  4. chunksRef.current = []
  5. setState('idle')
```

---

## Upload Flow

```
uploadAudio(blob, mimeType, duration):
  1. auth.currentUser check
  2. path = voice-messages/{uid}/{Date.now()}.{ext}
  3. uploadBytesResumable(storageRef, blob, { contentType: mimeType })
  4. await task completion
  5. getDownloadURL(storageRef)
  6. onSend(url, duration)
  7. setState('idle')
```

---

## Cross-Browser MIME Detection

Picks the first supported candidate from an ordered list (broader than the legacy two-way check):
```
audio/webm;codecs=opus   (Chrome / Android Chrome / Edge)
audio/webm
audio/mp4                (Safari / iOS)
audio/aac
```

File extension: `m4a` for the mp4/aac family, otherwise `webm`.

---

## UI States

**Idle:**
- Single mic button (`Mic` icon). Colors via theme tokens (muted -> primary on hover), not hardcoded slate/orange.

**Recording:**
- Inline bar with a pulsing dot + elapsed time (MM:SS)
- Cancel (`X`) + Stop+Send (`Square`) controls

**Uploading:**
- Inline bar with a spinning `Loader2` + "Sending..." text

---

## Error Handling

Failures are surfaced to the user via toasts (NOT silent - the legacy "fail quietly" note is stale). A microphone permission-denied error is handled as a distinct case with its own message. State resets to idle after an error.
