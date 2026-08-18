# Capability Census — Web vs. the REAL Flutter App

**Status:** Corrected. **Last updated:** 2026-07-28

**App under audit:** `/Users/sargupta/SahayakAIV2/wt-flutter-rebuild/sahayakai-flutter`
— the shipping Flutter rebuild: **405 Dart files**, `lib/features/*` architecture,
package `com.sargvision.sahayakai`, branch `feature/flutter-rebuild`. Every path in
this document was opened and read in that tree; paths are relative to its root.

**Web source of truth (read-only reference):**
`/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src`.

> ### Correction notice — the first version of this file was invalid
> The prior CAPABILITY_CENSUS.md audited `sahayakai/sahayakai_mobile` (a stale,
> abandoned app: `lib/src/*` layout, package `app.sahayakai.mobile`, ~190 files).
> Its headline findings — a "dead mic button", an "orphaned `VidyaChatScreen`
> reachable only through a `VidyaFab` that is mounted nowhere", "two parallel copies
> of every screen" — describe **that** dead tree and are **false for the app the
> founder is judging.** They are retracted. In the real app the VIDYA voice pipe is
> genuinely built, the home landing IS the voice canvas, and the mic is live. The
> real gap is narrower and specific: **VIDYA prefills a tool's form but never presses
> Generate.** This document reflects the real tree only.

---

## Bottom line

The real Flutter app is **at or near parity** with the web on the voice-first payoff,
not a shell of it. VIDYA is the **home landing tab** (not an orphan): one mic press runs
`capture → VAD auto-stop → STT → intent-classify → TTS speak-back → navigate + prefill`,
and the same brain is reachable from every tool screen's app bar. Image generation,
the AI parent *call*, curated video, and inline field dictation are all present.

There are exactly **four real gaps** against the web, and only the first is a payoff-loop
gap:

1. **No AUTO-RUN.** VIDYA navigates to the right tool and fills the form, but the tool
   never auto-submits — the teacher still taps *Generate*. The loop stops one step short
   of "hear the answer without touching the screen."
2. **No always-floating Omni-Orb overlay.** The web mounts `<OmniOrb />` globally in the
   shell so the orb sits on every pixel. Flutter instead gives you the mic as the Home
   tab plus a VIDYA app-bar action on tool screens — same brain, reachable everywhere,
   but not one persistent floating orb.
3. **No real-time streaming voice.** The web has a WebSocket → Gemini Live variant
   (`omni-orb-live.tsx`); Flutter's pipe is turn-based only.
4. **No voice-note parent messages.** The web has an audio recorder for messages;
   Flutter's Parent Message tool drafts **text** only.

---

## Census table

| # | Capability | Web (source of truth) | Real Flutter app | Verdict |
|---|---|---|---|---|
| 1 | Global "Omni-Orb" voice control plane | `<OmniOrb />` mounted globally in `app/app-shell.tsx` (always on every page) | VIDYA is the **Home landing tab** + a VIDYA app-bar action on every tool screen (same brain, modal sheet) | **Present** (reachable everywhere); **partial** in form (no floating overlay) |
| 2 | Voice payoff loop `speak→navigate→auto-fill→AUTO-RUN→hear-back` | Full loop incl. auto-generate | STT + classify + TTS speak-back + navigate + **prefill**, but **no auto-run** | **Partial** — every step except the final auto-submit |
| 3 | Intent classification (`/api/assistant`) | Present, reachable | Present via `vidya_repository`, **reachable** (VIDYA home is the landing tab, not orphaned) | **Present** |
| 4 | Video generation vs. playback | Curates YouTube search results (no generation) | Curates YouTube results (`video_storyteller`); opens external watch URLs | **Present as curation**; generation absent on **both** |
| 5 | Audio / TTS read-aloud | TTS available | VIDYA **auto-speaks** replies on the voice path; no read-aloud button on tool results | **Present** (auto, not manual-only) |
| 6 | STT / voice capture + VAD auto-stop | Present | Present with **VAD auto-stop** (amplitude-driven) | **Present** |
| 7 | Voice-note parent messages | `messages/voice-recorder.tsx` records + uploads audio | Parent Message drafts **text** only | **Absent** |
| 8 | AI parent voice **CALL** (Twilio) | Present | Present — `parent_hotline` over `/api/attendance/*` (outreach → placeCall → poll summary) | **Present** |
| 9 | Real-time / streaming voice | `omni-orb-live.tsx` (WebSocket → Gemini Live) | Turn-based only, no WebSocket | **Absent** |
| 10 | Image generation in-app | `visual-aid` (Gemini image model) | Present — `visual_aid` returns a base64 image | **Present** |
| 11 | Inline field dictation | `inline-mic-button.tsx` | Present — `InlineFieldMic` (STT-only into a field) | **Present** |

---

## Detail — every claim traced to a file that was read

### 1. Omni-Orb / global voice surface — reachable everywhere, but not a floating overlay

- **VIDYA is the Home landing tab, not an orphan.** `lib/features/dashboard/presentation/app_shell.dart`
  builds a 4-tab shell whose index 0 is `const VidyaHomeScreen()` and whose Home nav
  glyph is deliberately `LucideIcons.mic` ("a mic, not a house" — the doc comment calls
  it "the founder's #1 correction"). The router confirms the path:
  `lib/core/router/app_router.dart` maps `Routes.home → AppShell`, and `AppShell`'s first
  tab is VIDYA.
- **The same brain is reachable from every tool screen.** `lib/shared/widgets/tool_scaffold.dart`
  carries `vidyaAction = true` **by default** (line 24) and renders
  `actions: [if (vidyaAction) const VidyaAppBarAction()]` (line 43). `VidyaAppBarAction`
  (`lib/features/vidya/presentation/vidya_sheet.dart`) opens `showVidyaSheet`, a modal
  `VidyaSheet` that "reuses the SAME top-level `VidyaController` as the home, so the
  conversation is continuous across surfaces." `parent_hotline_screen.dart` wires the same
  action explicitly.
- **What's missing vs. web:** the web mounts `<OmniOrb />` once in `app/app-shell.tsx`
  (line 119) so a floating orb is literally on-screen everywhere. Flutter has no
  equivalent always-visible floating widget — it's the Home-tab Seal Mic plus an app-bar
  entry point. Reach is at parity; the *persistent-overlay* form is not.

### 2. The payoff loop — built through prefill, stops before AUTO-RUN

The whole state machine lives in `lib/features/vidya/presentation/vidya_controller.dart`
(`VidyaController`, a `keepAlive` Riverpod notifier). One `onMicTap()` runs
`_begin → capture → _stopAndProcess → _converse`:

- **Speak-back is real and automatic.** In `_converse` (lines ~651–664) the controller sets
  `VidyaStatus.speaking`, calls `_tts.synthesize(...)` and
  `_player.playBase64Mp3(tts.audioContent)` — the reply is spoken without any button.
- **Navigate + prefill is real.** A single valid intent becomes `pendingNavigation`
  (lines ~666–671). `lib/features/vidya/presentation/vidya_home_screen.dart` (lines 68–78)
  listens for it, calls `consumeNavigation()`, then `VidyaNavDispatcher.dispatch(...)`.
- **Prefill lands in the form.** `lib/features/vidya/presentation/vidya_nav_dispatcher.dart`
  maps each `VidyaFlow` to its `Routes` constant and passes a `ToolPrefill` via `extra`;
  `lib/core/router/app_router.dart` reads it with `_prefillOf(state)` into each tool screen.
- **AUTO-RUN is genuinely absent.** In `lib/features/lesson_planner/presentation/lesson_plan_screen.dart`,
  `initState()` (line 58) calls `_applyPrefill(widget.prefill)` (line 61) — which seeds the
  topic/grade/subject/language fields (lines 68–79) — but **never** calls `_submit()`
  (line 87). `_submit` is wired only to the button / retry / regenerate. The same
  `initState → _applyPrefill`, no-auto-submit shape holds for every prefilled tool
  (`quiz_generator`, `rubric_generator`, `instant_answer`, `visual_aid`, `teacher_training`,
  `video_storyteller`, `virtual_field_trip`). A repo-wide search for `autoSubmit` /
  `autoRun` / `autoGenerate` returns **nothing**. The teacher must press Generate.

### 3. Intent classification — present and reachable

`lib/features/vidya/data/vidya_repository.dart` — `VidyaRepository.ask(...)` POSTs to
`/api/assistant` (`_path`, line 21). It is driven by `VidyaController._converse`, which
runs from the Home tab's Seal Mic and from the everywhere `VidyaSheet`. Because VIDYA home
is the landing surface (see §1), this path is exercised by the *default* app entry, not a
hidden screen.

### 4. Video — curation of existing YouTube results, not generation

`lib/features/video_storyteller/domain/video_storyteller.dart` states it outright:
*"This is a BROWSE result — curated existing videos, not a generated document."* The result
is a `Map<VideoCategory, List<Video>>` of `YouTubeVideo` objects; each `Video` carries a
`watchUrl` (`https://www.youtube.com/watch?v=<id>`) that opens **externally** — there is no
in-app player and no generated video. `lib/features/video_storyteller/data/video_storyteller_repository.dart`
POSTs to `/api/ai/video-storyteller`. The web is the same shape (its flow generates YouTube
search-query strings), so video **generation is absent on both sides** — this is parity,
not a Flutter regression.

### 5. Audio / TTS read-aloud — VIDYA auto-speaks; tool results do not

- **TTS gateway:** `lib/features/vidya/data/tts_repository.dart` — `synthesize({text, targetLang})`
  POSTs `/api/tts` and returns base64 MP3.
- **Playback:** `lib/shared/voice/audio_player_service.dart` — `playBase64Mp3(...)` decodes
  and plays in-memory bytes (via a `StreamAudioSource`), cancelling any clip in flight.
- **Auto, not manual-only:** as in §2, `VidyaController._converse` calls both automatically
  on the voice path, so a spoken confirmation is *heard* every turn. What's absent is a
  per-tool "read this result aloud" button — e.g. `parent_message_result_view.dart` has no
  audio affordance (its actions are Regenerate / Copy / Share). So: VIDYA read-aloud is
  present and automatic; tool-result read-aloud is not wired.

### 6. STT / voice capture with VAD auto-stop — present

- **STT gateway:** `lib/features/vidya/data/voice_to_text_repository.dart` — `transcribe(...)`
  POSTs multipart to `/api/ai/voice-to-text`.
- **Capture + VAD:** `lib/features/vidya/presentation/vidya_controller.dart` defines the
  thresholds (`kSpeechOnsetLevel = 0.18`, `kTrailingSilence = 2500ms`, `kInitialSilence = 5000ms`,
  `kMaxCapture = 30s`, `kMinAudioBytes = 2000`) and `_onAmplitude` (lines ~531–542) arms a
  trailing-silence timer once speech is detected, so **capture auto-stops** — "the teacher
  never has to press stop." Amplitude comes from `lib/shared/voice/audio_recorder_service.dart`
  (a broadcast amplitude stream); permission via `lib/shared/voice/mic_permission_service.dart`.

### 7. Voice-note parent messages — absent

`lib/features/parent_message/data/parent_message_repository.dart` POSTs `/api/ai/parent-message`
and returns a **text** `ParentMessage`. There is no audio field in
`lib/features/parent_message/domain/parent_message.dart` / `..._dtos.dart`, and no recorder
or player in the screen (actions are Regenerate / Copy / Share). The web, by contrast, ships
`components/messages/voice-recorder.tsx`, which records audio and uploads it to Firebase
Storage. Flutter has no counterpart. **Absent.**

### 8. AI parent voice CALL (Twilio) — present

`lib/features/parent_hotline/data/parent_hotline_repository.dart` binds four
`/api/attendance/*` routes: `createOutreach` (POST `outreach` → `outreachId`), `placeCall`
(POST `call` → `callSid`), `pollSummary` (GET `call-summary`), `latestForStudent`
(GET `outreach-latest`). `placeCall` sends only `{ outreachId, parentLanguage }` — never the
phone number — and returns the provider `callSid`; the server places the actual (Twilio)
call. Backed by a full screen, controller, roster provider, `calling_stage`, and
`summary_sheet` under `lib/features/parent_hotline/`, routed at `Routes.parentHotline`.
**Present.**

### 9. Real-time / streaming voice — absent

The Flutter pipe is strictly turn-based (`capture → STT → /api/assistant → TTS`); a search of
`lib/features/vidya` and `lib/shared/voice` finds no WebSocket, no live/streaming client —
only the `record` package's amplitude `Stream`. The web ships a real-time variant,
`components/omni-orb-live.tsx`, which opens a **WebSocket** to the Gemini Live API and streams
mic audio in / TTS audio + tool calls out (`new WebSocket(url)`, `MediaRecorder`,
`getUserMedia`). Flutter has no equivalent. **Absent** (turn-based only).

### 10. Image generation in-app — present

`lib/features/visual_aid/data/visual_aid_repository.dart` POSTs `/api/ai/visual-aid`;
`..._dtos.dart` documents the 200 payload's `imageDataUri` as *"the generated drawing as a
`data:image/...;base64,...` URI (the Gemini image model's output)"* and decodes it to raw
bytes (`_decodeImageDataUri`). This is genuine in-app image **generation** (the Visual Aid
Designer). (Note: `assessment_scanner`, `/api/ai/assessment-scanner`, is image *input* /
grading — not generation.) **Present.**

### 11. Inline field dictation — present

`lib/features/vidya/presentation/widgets/inline_field_mic.dart` — `InlineFieldMic` is a
"dictate this field" affordance that runs **STT only** (no VIDYA, no TTS, no conversation):
it reuses the same recorder, permission gate, STT repository, and VAD thresholds
(`kSpeechOnsetLevel`, `kTrailingSilence`, …) as the Home Seal Mic, and drops the transcript
straight into the host form field via `onResult`. **Present.**

---

## Direct answers for the REAL app

**Where is the Omni-Orb?** There is no single always-floating orb like the web's globally
mounted `<OmniOrb />`. Its capability is split into two reachable surfaces that share one
brain: (a) **VIDYA is the Home landing tab** — the Seal Mic in
`lib/features/vidya/presentation/vidya_home_screen.dart`, mounted as index 0 of
`lib/features/dashboard/presentation/app_shell.dart`; and (b) a **VIDYA app-bar action on
every tool screen** — `VidyaAppBarAction` → `showVidyaSheet` in
`lib/features/vidya/presentation/vidya_sheet.dart`, added by default through
`lib/shared/widgets/tool_scaffold.dart` (`vidyaAction = true`), opening a modal that reuses
the same top-level `VidyaController`. So: reachable from anywhere, but as a mic-tab + app-bar
sheet, not a persistent overlay.

**Where is video?** `lib/features/video_storyteller/` — it **curates existing YouTube
videos** (`/api/ai/video-storyteller`, `video_storyteller_repository.dart`) and opens their
external `watchUrl`. Its own domain doc says "a BROWSE result… not a generated document."
There is no video generation and no in-app player (parity with the web).

**Where is audio?** TTS synthesis is `lib/features/vidya/data/tts_repository.dart`
(`/api/tts`) and playback is `lib/shared/voice/audio_player_service.dart`
(`playBase64Mp3`). VIDYA **auto-speaks** every reply via
`VidyaController._converse` in `lib/features/vidya/presentation/vidya_controller.dart` — it is
not manual-only. The only thing missing is a per-tool "read result aloud" button on the tool
result views.
