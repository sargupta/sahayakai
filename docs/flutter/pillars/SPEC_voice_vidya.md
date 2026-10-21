# SPEC — Pillar 01+02: VOICE-FIRST / VIDYA (the soul)

**Status:** DRAFT for the autonomous build loop · **Lens:** Voice-first interaction + VIDYA co-teacher
**Reuses:** `docs/flutter/design/PREMIUM_DESIGN_SPEC.md` ("Ledger · Ivory & Ink, Saffron & Pine")
**Backend (READ-ONLY, do not edit):** `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main`
**Scope of this doc:** the voice-first HOME (VIDYA conversation), the mobile voice stack (record +
playback + permissions), and how the mic threads into every tool ("I speak in Kannada → it makes the
plan"). Other pillars (hotline, staffroom, inbox) get sibling specs; this one is the north star.

> The product's soul is **voice-first**. The Flutter app I shipped is form-first and missed it entirely.
> The HOME must become a nearly-empty screen with **one large saffron "seal" mic** — the VIDYA
> conversation — and every other surface must reuse the already-built Ledger widgets. This spec
> reverse-engineers the production voice pipeline exactly, then specifies the premium Flutter build.

---

## PART A — THE PRODUCTION INTERACTION MODEL (reverse-engineered end to end)

The web app has TWO voice surfaces sharing one brain:
- **OmniOrb** (`src/components/omni-orb.tsx`) — the floating, draggable mic mounted globally in the app
  shell; present on **every page except `/` and `/onboarding`**. This is the reference model.
- **VoiceAssistant** (`src/components/voice-assistant.tsx`) — a page-mounted chat dialog (used by
  `/teacher-training`). When it opens it sets `voiceDialogOpen=true` and OmniOrb hides itself so two
  mics never compete. Flutter only needs to replicate the **OmniOrb** model.

Both drive the same capture widget `MicrophoneInput` (`src/components/microphone-input.tsx`), the same
Zustand store `useJarvisStore` (`src/store/jarvisStore.ts`), and the same 3 backend calls: **STT →
VIDYA → TTS**.

### A.1 The pipeline (one mic press, full trip)

```
tap mic
  │  (greeting on FIRST press only: tts.speak("Good morning, Teacher…"))
  ▼
[capture]  navigator.mediaDevices.getUserMedia({audio:{noiseSuppression,echoCancellation,autoGainControl:false}})
           MediaRecorder → audio/ogg;codecs=opus  (fallback audio/webm;codecs=opus)
           VAD via Web Audio AnalyserNode (see A.4) auto-stops on 2.5s trailing silence
           ALSO runs free browser SpeechRecognition concurrently (cost optimisation)
  ▼
[STT]      IF browser SpeechRecognition captured ≥2 chars → use it, SKIP the cloud call (free)
           ELSE POST /api/ai/voice-to-text  (multipart)   → { text, language }
  ▼
[VIDYA]    POST /api/assistant  { message:text, chatHistory, currentScreenContext, teacherProfile,
                                  detectedLanguage, uiLanguage }  → { response, action, plannedActions[] }
  ▼
[speak]    tts.speak(response, bcp47)  →  POST /api/tts { text, targetLang } → base64 mp3 → new Audio().play()
  ▼
[act]      action.type==='NAVIGATE_AND_FILL' → router.push(`/${flow}?topic=…&gradeLevel=…&subject=…&language=…`)
           (compound: 2–3 plannedActions render as one-tap "confirm chips" instead of auto-navigating)
  ▼
[persist]  POST /api/vidya/session  (turn pair + actionTriggered)   ·  POST /api/vidya/profile (grade/subject only)
```

### A.2 STT contract — `POST /api/ai/voice-to-text`
`src/app/api/ai/voice-to-text/route.ts`

- **Auth:** `Authorization: Bearer <firebaseIdToken>` → middleware injects `x-user-id`. 401 without it.
- **Body:** `multipart/form-data`
  - `audio` — the recording **File** (required). **Max 10 MB** (413 over).
  - `expectedLanguage` — optional 2-letter ISO (`bn`,`ta`,…). Biases detection + fires the
    script-mismatch retry. Client sends the teacher's UI language here.
  - `language` — optional 2-letter ISO hint (the mic component also appends this).
- **Provider routing (server-side, invisible to client):**
  - **Sarvam Saaras v3** is tried FIRST *only if* the audio MIME matches
    `audio/(mpeg|mp3|wav)` — **opus/webm/ogg is rejected by Sarvam and skipped**. Sarvam is the
    cheap, Indic-purpose-built path.
  - Else / on failure → **Gemini multimodal** via a base64 `data:` URI dispatcher.
- **Response 200:** `{ "text": string, "language": string }` — `language` is a **normalised 2-letter
  code** (`od`→`or`, etc.). On failure `500 { error, code:"INTERNAL_ERROR" }`.
- **Latency note:** WAV/MP3 → Sarvam fast path (best for Kannada/Bengali/Tamil). Opus → Gemini
  (slower, but the only path browsers can produce). **This is the single most important choice the
  Flutter client makes — see C.2: record WAV to unlock the Sarvam fast path.**

### A.3 VIDYA contract — `POST /api/assistant`
`src/app/api/assistant/route.ts` → `dispatchVidya` → `runGenkitVidya` (`src/ai/flows/vidya-assistant.ts`)

- **Auth:** Bearer → `x-user-id`. 401 without.
- **Request JSON:**
  ```jsonc
  {
    "message": "Class 10 ka Maths ka lesson plan banao",      // required, ≤4000 chars
    "chatHistory": [ { "role": "user"|"model", "parts": [{ "text": "…" }] } ],
    "currentScreenContext": { "path": "/lesson-plan", "uiState": { "page":"lesson-plan", "topic":"…" } },
    "teacherProfile": { "preferredGrade":"Class 10", "preferredSubject":"Maths",
                        "preferredLanguage":"Hindi", "schoolContext":"…" },
    "detectedLanguage": "hi",   // 2-letter, from STT — best-guess, can be wrong
    "uiLanguage": "hi"          // 2-letter, EXPLICIT from the app language — WINS over detectedLanguage
  }
  ```
- **Response JSON:**
  ```jsonc
  {
    "response": "Generating your Class 10 Maths lesson plan now!",   // what VIDYA speaks back
    "action": {                                                      // singular, legacy/v0.3 compat
      "type": "NAVIGATE_AND_FILL",
      "flow": "lesson-plan",
      "params": { "topic":"…","gradeLevel":"Class 10","subject":"Maths","language":"hi",
                  "ncertChapter": { "number":4,"title":"Quadratic Equations" } }
    },
    "plannedActions": [                                              // 0–3 items, the real queue
      { "type":"NAVIGATE_AND_FILL", "flow":"quiz-generator",
        "params": { "topic":"…","gradeLevel":null,"subject":null,"language":"hi",
                    "ncertChapter":null, "dependsOn":[],
                    "clarifyingPrompt":null, "validationWarning":null } }
    ]
  }
  ```
- **`flow` is a closed enum** (client must guard — a hallucinated flow routes to a 404):
  `lesson-plan · quiz-generator · visual-aid-designer · worksheet-wizard · virtual-field-trip ·
  teacher-training · rubric-generator · exam-paper · video-storyteller · instant-answer`.
- **Behaviour the client must replicate:**
  - **0 actions** → pure conversational turn (just speak `response`).
  - **1 valid action** → auto-navigate to the tool, prefilled.
  - **2–3 valid actions** ("make a quiz AND a worksheet") → render **confirm chips**; teacher taps each.
  - **Caching:** the route L1/L2-caches fresh single-turn conversational replies; the client does not
    manage this.
  - **Fresh-classification rule:** each utterance is a fresh intent — the client must NOT smuggle a
    prior turn's grade/subject/topic in unless it's a genuine same-screen follow-up (see A.6).

### A.4 Capture + VAD (what "listening" actually is)
`src/components/microphone-input.tsx`

- MIME preference: `audio/ogg;codecs=opus` → `audio/webm;codecs=opus` → default.
- VAD from `AnalyserNode` frequency bins in the **300–3000 Hz human-voice band**:
  `SPEECH_THRESHOLD=25`, needs `MIN_SPEECH_FRAMES=3` consecutive loud frames to flip to "speaking"
  (rejects coughs/door slams).
  - trailing silence cutoff once speaking: **2500 ms**
  - initial silence (before any speech): **5000 ms**
  - hard cap: **30000 ms** failsafe
  - reject blobs `< 2000 bytes` (silence/mis-tap) before paying for STT.
- Also guards against Gemini's "I'm sorry, I cannot process the audio" **refusal strings** leaking
  into chat as a fake teacher turn (`isLikelyTranscriptionRefusal`).

### A.5 TTS contract — `POST /api/tts`
`src/app/api/tts/route.ts`, played by `src/lib/tts.ts`

- **Request:** `{ "text": string, "targetLang": "hi-IN" }` (BCP-47; if omitted the server detects from
  script). Auth Bearer.
- **Response:** `{ "audioContent": "<base64 mp3>", "voiceQuota"?: {...} }`. `413` if `text>5000` chars,
  `429` rate-limited.
- **Provider chain:** Sarvam Bulbul → Bhashini (te/mr/or) → Google Cloud TTS. Female "VIDYA" persona,
  `speakingRate 0.92`. Markdown is stripped server-side before synthesis.
- **Playback (client):** `new Audio('data:audio/mp3;base64,'+audioContent).play()`; a module-level
  `activeAudio` lets `tts.cancel()` stop the previous clip before the next `speak()`. In-memory LRU
  cache (50) keyed on `lang:len:first100`.
- **Language mapping the client owns:** STT 2-letter → TTS BCP-47 via `LANG_TO_BCP47`
  (`{en:en-IN, hi:hi-IN, bn:bn-IN, ta:ta-IN, te:te-IN, kn:kn-IN, ml:ml-IN, gu:gu-IN, pa:pa-IN,
  mr:hi-IN, or:en-IN}` — note **mr borrows Hindi voice, or has no voice → English**).

### A.6 The on-screen STATE MACHINE
Two coupled machines. **Capture** (`MicStatus`) and **Conversation** (`processTranscription`).

```
CAPTURE:  idle ──tap──▶ greeting(first press only) ──▶ initializing ──▶ recording ──(VAD silence/tap/30s)──▶ processing ──▶ idle
                                                                             │ tap again = cancel (forceReset)
CONVERSATION (after processing yields transcript):
  transcript ─▶ addMessage(user) ─▶ POST /api/assistant ─▶ addMessage(model) + tts.speak(response)
                                          │
             ┌────────────────────────────┼───────────────────────────────┐
        0 actions                     1 action                        2–3 actions
     (speak only)              navigate+prefill (auto)            render confirm chips
```
Visual state → label mapping (from `getLabelString`): `greeting/recording`="I'm listening…",
`initializing`="Getting ready…", `processing`="Thinking…", `idle`="Tap to speak". This is the exact
idle → listening → thinking → speaking → conversation cycle the Flutter home must render.

### A.7 How VIDYA is PERSISTENT ("a coach on every page")
- **Global mount:** OmniOrb lives in the app shell, so its store + mic follow the teacher across every
  route. It auto-hides on scroll (reading) and restores on idle/scroll-up — presence without nagging.
- **Session memory:** `useJarvisStore` keeps the last 20 turns + `teacherProfile` + `structuredData`
  (the live form fields of the current page) + `formSnapshots`, persisted to `localStorage`
  (`jarvis-storage`). On login it **restores from Firestore**: `GET /api/vidya/profile` and
  `GET /api/vidya/session` (latest session, capped 50 msgs). Cross-device continuity.
- **Session doc:** `users/{uid}/vidya_sessions/{sessionId}` — `{ messages[], actionsTriggered[],
  screenPaths[] }`, max 10 sessions/user. `POST /api/vidya/session` writes turn pairs fire-and-forget.
- **Screen awareness:** on every navigation OmniOrb publishes `{path, uiState}` into the store; tool
  pages push their live form fields via `useVidyaFormSync(pageKey, values)`
  (`src/hooks/use-vidya-form-sync.ts`) so VIDYA can literally "see" the half-filled form and reason
  about it. Stale form data is wiped on navigation (`clearStructuredDataIfStale`) to stop one page's
  fields bleeding into the next intent.
- **Profile poisoning guard:** grade/subject learned from an action are persisted; **`language` is
  NEVER persisted from an utterance** (a one-off Kannada question must not flip the teacher's whole app
  to Kannada). Replicate this exactly.

### A.8 How voice THREADS INTO the tools ("I speak in Kannada → it makes the plan")
1. Teacher speaks anywhere. STT → transcript.
2. `/api/assistant` classifies intent → `{flow:'lesson-plan', params:{gradeLevel, subject, topic,
   language, ncertChapter}}`.
3. Client builds `/<flow>?topic=…&gradeLevel=…&subject=…&language=…` and navigates.
4. The destination tool form **reads those query params as prefill**, so the teacher lands on a
   lesson-plan form already filled from their spoken sentence — often one tap from generating.
5. If VIDYA couldn't extract a `topic`, the client backfills it from the last user utterance.
6. `language` is normalised to an ISO-2 code before it hits the URL (`normaliseVidyaLanguage`) because
   the tool's language selector is keyed on ISO — this is half the fix for the "form shows English,
   output Hindi" bug; the other half is never writing utterance-language to the profile.

---

## PART B — THE PREMIUM FLUTTER HOME (nearly-empty, one large seal mic)

The home becomes **"The Almanac Speaks"**: a warm ivory page, mostly empty, with one large saffron
**wax-seal mic** at the optical centre and a single serif prompt. When the teacher speaks, their words
and VIDYA's reply **ink onto the page as document blocks** (never chat bubbles). Every pixel reuses the
Ledger system — no new visual language.

### B.1 Screen skeleton — `lib/features/vidya/presentation/vidya_home_screen.dart` (new)

```
Scaffold (transparent app bar, seamless — PREMIUM_DESIGN_SPEC §5 "App bar")
 └ DecoratedBox(AppGradients.lightPaper / darkVignette)          // paper ground, never scaffoldBg
    └ SafeArea
       └ CustomScrollView (reverse:false)
          ├ Sliver: EDITORIAL MASTHEAD (idle only, fades out once a conversation starts)
          │    · eyebrow  "YOUR CO-TEACHER"        → AppTextExtras.eyebrow (saffron #A8380A, tracked)
          │    · serif greeting "Good morning, Teacher."  → displayLarge (Fraunces 32/600), time-aware l10n
          │    · lead deck  "Just speak — in your language — and I'll prepare it."  → lead (17/400 muted)
          │    · 2px×48dp saffron rule (AppGradients.accentBar)   // the almanac kicker
          │
          ├ Sliver: CONVERSATION REGISTER (grows as turns land)
          │    · each turn = a document block, NOT a bubble:
          │        - user turn  → AppCard(inset): overline "YOU SAID" + bodyLarge transcript (Indic AiText)
          │        - VIDYA turn → AppCard(flat) + 3px saffron top accentBar: section tick + bodyLarge reply
          │    · reveal via inkSettle (fadeIn + moveY 8→0, 350ms easeOutQuart, 40–55ms stagger)
          │    · compound intent → a Wrap of confirm chips (see B.4)
          │
          └ Sliver (pinned bottom via SliverFillRemaining or a bottomSheet-anchored area):
               THE SEAL MIC  (the hero — see B.2)
```

Layout intent: on first open the **seal mic sits large and centred** with only the masthead above it and
empty ivory around it (< 10% saffron, per §7.5). As the conversation grows, the register fills upward and
the mic settles to a persistent anchored position (thumb-reachable, bottom-centre). Reading column caps at
640 (`ConstrainedBox`, already enforced by `ToolScaffold`).

### B.2 The Seal Mic — `lib/features/vidya/presentation/widgets/seal_mic.dart` (new)

A large circular **wax-seal** press control. Reuses the depth/motion/colour engine; it is an authored
"signature moment" like the splash Seal, not a floating action button.

- **Geometry:** 128dp idle hero (`iconSize xl` parity), settles to 72dp when anchored. `StadiumBorder`/
  circle, radius = full.
- **Fill:** `brandSaffron #FF9933` seal face is *decorative-large* (allowed; never behind small text),
  ringed by a 2px `brandBrass #B08D57` seal ring; the glyph is a Lucide `mic` in `onPrimary`. In dark,
  candlelit `dPrimary #F6A959`. CTA glow `AppShadows.ctaGlowLight` / `dSaffronGlow` so it reads *lit*.
- **States (mirror A.6):**
  | State | Visual | Motion | Label (l10n) |
  |---|---|---|---|
  | `idle` | seal at rest, e2 + soft ctaGlow | 3000ms breathing halo (opacity `primary@0.06↔0.12`), like `EmptyView` breathe | "Tap to speak" |
  | `greeting` | seal lit | hold; TTS greeting plays | "…" (subtitle: greeting text) |
  | `listening` | two concentric saffron rings pulse; live **waveform** ring | ring scale/opacity driven by amplitude stream (C.2) | "I'm listening…" |
  | `thinking` | seal dims to `primary@0.9`; arc spinner ring | `standard` rotation, shimmer optional | "Thinking…" |
  | `speaking` | seal shows a soft equaliser under the glyph while TTS plays | amplitude-agnostic 3-bar pulse | "…" (VIDYA speaks) |
  All within the 3-curve / ≤420ms budget; **reduce-motion** (`context.motionEnabled==false`) → static
  composed frame, no rings, no breathe.
- **Press:** `PressScale` 0.97 + glow tightens (reuse `lib/shared/widgets/press_scale.dart`).
- **Tap semantics:** idle→start; listening→stop-now; thinking/speaking→cancel (`tts.stop`, abort STT).
- **A11y:** ≥48dp always; `Semantics(button:true, label:"VIDYA voice", hint:<state label>)`.

### B.3 The conversation as DOCUMENT BLOCKS
Reuse — do **not** invent bubbles:
- `AppCard(variant: inset)` for the teacher's transcript (recedes, "what you said"), `overline` label.
- `AppCard(variant: flat)` + 3px `accentBar` for VIDYA's reply, with a `section_label.dart` saffron tick.
- Body text goes through the **existing `AiText`** widget (line-height 1.7, Indic matra-safety) —
  never a raw `Text`, so Kannada/Bengali/Tamil replies render correctly.
- Reveal each block with the `inkSettle` helper (already specced in PREMIUM_DESIGN_SPEC §4 / U4).
- A long VIDYA answer that is really a generated artifact (rare on home) can escalate to
  `DocumentSheet` — the same widget the tools use — for visual continuity.

### B.4 Compound-intent confirm chips
When `plannedActions.length > 1`, render a `Wrap` of chips under VIDYA's reply (reuse Chip grammar,
PREMIUM_DESIGN_SPEC §5 "Chip"): `primaryContainer` fill, 1.5px `primary` border, Lucide `sparkles` +
`FLOW_LABEL`. Tapping a chip dispatches that one flow (navigate+prefill) and removes the chip. Single
action auto-navigates (no chip) to avoid an extra tap for the 90% case.

---

## PART C — THE MOBILE VOICE STACK (plugins, permissions, wiring)

### C.1 New dependencies (justified against the current pubspec)
Add to `pubspec.yaml` (current file has none of the audio stack):

```yaml
  record: ^5.1.2            # capture: cross-platform recorder with a live amplitude stream + encoder choice
  just_audio: ^0.9.42       # playback: robust gapless player; feed base64 mp3 via a StreamAudioSource
  permission_handler: ^11.3.1  # runtime mic permission (Android 6+/iOS), settings deep-link on denial
  audio_session: ^0.1.21    # configure the OS audio session (play-and-record, duck others) — just_audio peer
```

**Why `record` (not `flutter_sound`/`mic_stream`):** it exposes `onAmplitudeChanged` (drives the
listening-ring waveform in B.2), lets us pick the **encoder** (critical — see C.2), and returns a plain
file/stream we can multipart-POST. Actively maintained, no native build friction. **Why `just_audio`
(not `audioplayers`):** the backend returns **base64 mp3 bytes, not a URL**; `just_audio` supports a
custom `StreamAudioSource` so we can play bytes in-memory without a temp file, and it integrates with
`audio_session` so TTS ducks/interrupts cleanly. (`audioplayers` `BytesSource` is a viable simpler
fallback if `StreamAudioSource` proves fiddly.)

### C.2 Capture format decision — record WAV to unlock the Sarvam fast path
The web is stuck with opus (all a browser can emit), so it usually falls to the slower Gemini STT path.
**Flutter is not stuck** — `record` can encode PCM WAV. From A.2, Sarvam Saaras v3 only runs when the
uploaded MIME matches `audio/(mpeg|mp3|wav)`. Therefore:

```dart
await recorder.start(const RecordConfig(
  encoder: AudioEncoder.wav,   // → Sarvam Saaras v3 fast path (Indic-tuned, cheaper). NOT aacLc (audio/mp4 misses the regex).
  sampleRate: 16000,           // 16 kHz mono is plenty for speech and keeps the upload small
  numChannels: 1,
), path: '$tmpDir/vidya_utterance.wav');
```
Multipart the file as field **`audio`** with filename `recording.wav` and contentType `audio/wav`. Also
send `expectedLanguage` = the app's 2-letter locale (biases detection + script-mismatch retry). Keep the
10 MB / 30 s ceilings from A.4. **Do not** use `AudioEncoder.opus` unless you deliberately want the
Gemini path.

> Client-side VAD parity: `record`'s `onAmplitudeChanged` gives dB. Port the web VAD thresholds
> (speech onset, 2.5 s trailing-silence auto-stop, 5 s initial-silence, 30 s hard cap, min-size reject)
> into a small `VoiceCaptureController` so the teacher never has to press stop. Reuse the numbers in A.4.

### C.3 Playback of base64 mp3 (TTS)
```dart
class _Base64Mp3Source extends StreamAudioSource {
  _Base64Mp3Source(this._bytes);
  final Uint8List _bytes;
  @override
  Future<StreamAudioResponse> request([int? start, int? end]) async {
    start ??= 0; end ??= _bytes.length;
    return StreamAudioResponse(
      sourceLength: _bytes.length, contentLength: end - start, offset: start,
      contentType: 'audio/mpeg',
      stream: Stream.value(_bytes.sublist(start, end)),
    );
  }
}
// tts.speak: cancel current, decode base64, player.setAudioSource(_Base64Mp3Source(bytes)), player.play()
```
Mirror `tts.cancel()`: keep one player, stop the previous clip before the next `speak`. Configure
`audio_session` as `AudioSessionConfiguration.speech()` and duck other audio during playback.

### C.4 Permissions
- **Android** `android/app/src/main/AndroidManifest.xml`: `<uses-permission
  android:name="android.permission.RECORD_AUDIO"/>` (and `INTERNET`, already present).
- **iOS** `ios/Runner/Info.plist`: `NSMicrophoneUsageDescription` = "SahayakAI listens so you can speak
  your lesson request in your own language." (localise across 11 languages).
- Request at the moment of the **first mic tap** via `permission_handler` (`Permission.microphone`).
  On permanent denial → dignified `EmptyView` with a `SecondaryButton` "Open settings"
  (`openAppSettings()`). Never a raw error dialog.

### C.5 The voice orchestrator (Riverpod)
`lib/features/vidya/presentation/vidya_controller.dart` (new `Notifier`) — the single brain the home mic
AND every inline mic feed. Holds the state machine (A.6), owns `VoiceCaptureController` (record+VAD),
the STT/VIDYA/TTS repositories, and the conversation/session state (A.7). Mirrors `useJarvisStore`:
```
VidyaState { status, chatHistory[20], teacherProfile, screenContext{path,uiState},
             pendingActions[], sessionId, lastQueryAt, lastQueryPath }
```
Repositories go through the existing `ApiClient` (`lib/core/network/api_client.dart`, baseUrl
`https://sahayakai.com`, `AuthInterceptor` already attaches the Bearer token):
- `VoiceToTextRepository.transcribe(File wav, {String? expectedLanguage})` → `POST /api/ai/voice-to-text`
  (multipart — add a `postMultipart` to `ApiClient` or a dedicated `Dio` `FormData` call).
- `VidyaRepository.ask(AssistantRequest)` → `POST /api/assistant` → `AssistantResponse{response, action,
  plannedActions}` (new DTOs; enum-guard `flow` against the closed set in A.3, drop unknowns like the web).
- `TtsRepository.synthesize(text, bcp47)` → `POST /api/tts` → base64 → C.3.
- `VidyaSessionRepository` / `VidyaProfileRepository` → `/api/vidya/session` + `/api/vidya/profile`
  (fire-and-forget; restore on login).
Port the guards: fresh-classification windowing (5 min + same-path to decide whether to carry
`chatHistory`), the `MIN_AUDIO_BYTES` reject, the refusal-string filter, and **never persist utterance
`language` to profile**.

### C.6 VIDYA on EVERY screen (persistence in Flutter)
- The `VidyaController` is a top-level Riverpod provider → its state survives navigation (parity with the
  globally-mounted OmniOrb store).
- Surface it everywhere two ways:
  1. **Bottom-nav VIDYA entry** — the floating nav (PREMIUM_DESIGN_SPEC §5) already reserves a
     `Sparkles`/Create slot; make VIDYA the centre affordance that returns Home (the conversation).
  2. **Persistent mini-seal** — an optional small anchored seal mic on tool screens (like the web's
     floating OmniOrb) that opens the same controller, auto-hiding while the teacher reads a result
     (reuse the web's scroll-idle rule).
- **Screen awareness:** give each tool screen a tiny `registerScreenContext(path, formValues)` call in
  `initState`/on-change (the Flutter analogue of `useVidyaFormSync`) that writes into
  `VidyaController.screenContext.uiState`, and clears it on dispose — so a spoken "make this for Class 8
  instead" while on the lesson-plan form is understood in context.

### C.7 Threading voice INTO tool forms (the two mechanisms)
1. **Global VIDYA → navigate + prefill (primary).** On a single valid `NAVIGATE_AND_FILL`, build a
   go_router push with query params and let the tool read them:
   ```dart
   context.push(Uri(path: entry.route, queryParameters: {
     if (p.topic != null) 'topic': p.topic!,
     if (p.gradeLevel != null) 'gradeLevel': p.gradeLevel!,
     if (p.subject != null) 'subject': p.subject!,
     if (p.language != null) 'language': normaliseVidyaLanguage(p.language)!,  // ISO-2, matches the picker
   }).toString());
   ```
   Each tool screen (start with `lesson_plan_screen.dart`) reads
   `GoRouterState.of(context).uri.queryParameters` in `initState` and seeds its `TextEditingController`s
   / picker providers. `flow → Routes` map = the existing `kToolRegistry` (`id` already equals the web
   flow id, except map `quiz-generator→quiz`/`Routes.quizGenerator`). **Guard the flow enum** and drop
   unknowns exactly like the web (`KNOWN_FLOWS`).
2. **Inline field mic → voice-fill one field (secondary).** Add an optional trailing mic to
   `LabeledField` (`lib/shared/widgets/labeled_field.dart`) that runs **STT only** (no VIDYA intent) via
   the same `VoiceCaptureController`, and drops the transcript straight into that field's controller —
   for "speak the topic" without leaving the form. Web parity: `inline-mic-button.tsx`.

---

## PART D — BUILD UNITS (ordered, for the autonomous loop)

Branch from `develop`, one commit per unit, explicit `git add` paths, never push. Each unit:
`flutter analyze` = 0, `scripts/token_guard.sh` = PASS, existing behavior tests green, new tests added.

- **V1 — voice stack + permissions.** Add the 4 deps (C.1); Android/iOS permission entries (C.4);
  `VoiceCaptureController` (record→WAV 16k mono, amplitude stream, ported VAD thresholds A.4/C.2);
  `TtsPlayer` (just_audio + `_Base64Mp3Source` + audio_session, cancel semantics). Unit-test the VAD
  timers and the base64 source with fakes (no real mic/audio in CI).
- **V2 — backend repos + DTOs.** `VoiceToTextRepository` (multipart), `VidyaRepository`
  (`AssistantRequest`/`AssistantResponse`, `VidyaAction`, `PlannedAction` DTOs + `flow` enum guard),
  `TtsRepository`, `VidyaSession`/`VidyaProfile` repos — all via `ApiClient`. Golden-decode tests
  against the exact JSON in A.2/A.3/A.5.
- **V3 — `VidyaController`.** The state machine (A.6), conversation/session/profile state (A.7),
  fresh-classification windowing, language mapping (`LANG_TO_BCP47`, `normaliseVidyaLanguage`), the
  never-persist-language guard. Pure-Dart state tests (fake repos).
- **V4 — Seal Mic widget** (`seal_mic.dart`) — geometry, 5 states, breathing/listening/thinking/speaking
  motion, reduce-motion path, PressScale, Semantics. Goldens at 360/800 light+dark + reduce-motion.
- **V5 — VIDYA Home screen** (`vidya_home_screen.dart`) — masthead + conversation register (document
  blocks via `AppCard`+`AiText`+`inkSettle`) + anchored seal + compound chips. Replace the current
  form-first home; wire it as the `Routes.home` / app-shell landing. Goldens for idle / mid-conversation
  / compound-chips, Indic probe strings (Bengali/Tamil/Malayalam), light+dark.
- **V6 — thread into tools.** Nav+prefill dispatcher (C.7.1); make `lesson_plan_screen` read query-param
  prefill (reference impl); enum-guard + drop-unknown. Then inline field mic on `LabeledField` (C.7.2).
- **V7 — persistence + presence.** Firestore restore on login (session+profile), fire-and-forget turn
  sync, bottom-nav VIDYA affordance + optional mini-seal on tool screens with the scroll-idle auto-hide,
  `registerScreenContext` on each tool form.

---

## PART E — ACCEPTANCE ("premium voice-first done")
1. Home opens as a **near-empty ivory almanac** with one large lit saffron seal mic and a serif prompt —
   < 10% saffron, no form in sight.
2. One tap → greeting → **listening ring reacts to the teacher's voice** → "Thinking…" → VIDYA speaks
   back in the **same language**, and the turn **inks onto the page as a document block** (never a chat
   bubble).
3. "Class 10 Maths ka lesson plan banao" (or the same in Kannada/Bengali) → the app **navigates to the
   lesson-plan tool with grade/subject/topic/language prefilled**, one tap from generate.
4. Kannada/Bengali/Tamil replies render with **no clipped matras** (via `AiText`), and speak with the
   correct native voice (Sarvam/Bhashini/Google chain), `mr`→Hindi voice, `or`→English fallback.
5. VIDYA is **reachable and context-aware on every screen**; a spoken follow-up on a tool form is
   understood against that form's live fields; utterance language never poisons the saved profile.
6. All motion within the 3-curve / ≤420ms budget; **reduce-motion** shows composed frames; every control
   ≥48dp; Lucide-only, no emoji.

**File:** `docs/flutter/pillars/SPEC_voice_vidya.md`
