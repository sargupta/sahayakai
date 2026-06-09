# VoiceRecorder Component

**File:** `src/components/messages/voice-recorder.tsx`

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

**Refs (not state — no re-render):**
- `mediaRecorderRef` — `MediaRecorder` instance
- `chunksRef` — `Blob[]` audio data chunks
- `timerRef` — `NodeJS.Timeout` for elapsed counter
- `startTimeRef` — `number` recording start timestamp

---

## Recording Flow

```
startRecording():
  1. navigator.mediaDevices.getUserMedia({ audio: true })
  2. Detect MIME type: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') → webm, else mp4
  3. new MediaRecorder(stream, { mimeType })
  4. recorder.ondataavailable → push to chunksRef
  5. recorder.onstop → uploadAudio()
  6. recorder.start(250)  // collect chunks every 250ms
  7. setState('recording'), start elapsed timer

stopRecording():
  1. stopTimer()
  2. setState('uploading')
  3. mediaRecorder.stop() → triggers onstop → uploadAudio()

cancelRecording():
  1. stopTimer()
  2. Nullify ondataavailable + replace onstop (discard chunks)
  3. recorder.stop() — but onstop just stops stream tracks
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

```ts
const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
  ? 'audio/webm;codecs=opus'   // Chrome, Android Chrome, Edge
  : 'audio/mp4';               // Safari, iOS
```

File extension: `webm` for opus, `mp4` for mp4.

---

## UI States

**Idle:**
- Single mic button (`Mic` icon, h-10 w-10 rounded-xl)
- `text-slate-400 hover:text-orange-500 hover:bg-orange-50`

**Recording:**
- Inline bar: red-50 background, red-200 border
- Red pulsing dot + elapsed time (MM:SS format)
- Cancel (`X` icon) + Stop+Send (`Square` icon + "Send" text) buttons

**Uploading:**
- Inline bar: slate-50 background
- `Loader2` spinning orange + "Sending…" text

---

## Error Handling

Both recording failure (mic denied) and upload failure are caught silently — state resets to idle. No user error message shown (fail quietly, don't block chat).
