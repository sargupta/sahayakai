# CAPABILITY_CENSUS.md

**Scope:** Blunt present / partial / absent census of user-facing capabilities, web (source of truth) vs. the SahayakAI Flutter app. Every row is traced to code.

**Mobile app under audit:** `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai_mobile/` (the real, feature-complete Flutter app — 190+ Dart files). Paths below are relative to that root.
**Web source of truth:** `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src/`.
**Second Flutter tree** `sahayakai-flutter/` is a 4-file Phase-T offline spike, not the shipping app — see the last section. It is **not** what these rows judge.

---

## The one-line verdict

The web voice-first control plane does **not** exist on mobile. The single most important web artifact — the always-mounted, mic-only **Omni-Orb** that does speak → understand → act → auto-generate → hear back — has **no counterpart the user can reach**. The mobile app has the raw parts (an STT service, a TTS service, a `/assistant` repository, per-tool param pre-fill wiring) but they are wired into a screen that is **unreachable**, while the surface the user *can* reach is a plain text chatbot with a **dead mic button**. Video is not generated and not played anywhere. Read-aloud exists but is manual-only. Real-time streaming voice exists on neither side in production.

---

## Census table

| Capability | Web (source of truth) | Mobile (`sahayakai_mobile`) | Verdict on mobile |
|---|---|---|---|
| **Omni-Orb** (global, mic-only, always-on voice control plane) | `components/omni-orb.tsx` mounted globally in `app/app-shell.tsx:119`; mic-only; auto-hide/restore | **No global surface.** Home-only "Ask VIDYA anything…" bar (`home_screen.dart:383`) that navigates to a **text** `ChatScreen` with a **no-op mic** (`chat_screen.dart`, `Icons.mic_none_rounded, onPressed: () {}`). The rich voice screen (`vidya_chat_screen.dart`) is registered at `/vidya-chat` but its only launcher `VidyaFab` is **never mounted** anywhere. | **ABSENT** (the reachable thing is a decoy; the real one is dead code) |
| **Voice → auto-navigate → auto-fill → auto-submit** (the payoff loop) | `omni-orb.tsx:701-737` builds URL + `router.push`; target page auto-fills **and** `handleSubmit()` fires itself (`quiz-generator/page.tsx:210-233`) | Auto-**fill** is wired: router passes `state.extra` → `initialParams` for 6 tool routes (`app_router.dart:83-110`), and screens read them (`quiz_config_screen.dart:46-88`). But **no auto-submit** (initState never calls `_submit`), the action is a **card the user must tap** (`vidya_action_card.dart` `onTap: context.push(...)`), and the whole path lives inside the unreachable `vidya_chat_screen.dart`. | **PARTIAL / effectively ABSENT** (auto-fill code exists but trigger is unreachable; no auto-generate) |
| **Intent classification + param extraction** (`/assistant`, the brain) | `api/assistant/route.ts` → `vidya-assistant.ts` (Gemini, forced JSON, `NAVIGATE_AND_FILL`) | Code exists: `vidya_repository.dart:29` POSTs `/assistant` with `chatHistory`/`currentScreenContext`/`teacherProfile`. But it is only called from the **unreachable** `vidya_chat_screen.dart`. The **reachable** chat calls plain `/chat` (`chat_repository.dart`), which returns text only — **no actions, no routing**. | **ABSENT in the reachable path** |
| **Video generation** | Web Video Storyteller flow | **Nothing is generated.** `video_repository.dart` `/ai/video-storyteller` returns **YouTube search-query strings** grouped by category (`VideoOutput.categories`), rendered as a "script". "Export PDF" button is a stub (`video_storyteller_screen.dart`, `onPressed: () {}`). | **ABSENT** (recommendation engine, not generation) |
| **Video playback** | Web plays/embeds video | **No in-app player.** No `video_player`, `chewie`, or `webview_flutter` in `pubspec.yaml`. Tapping a recommendation opens **external** YouTube via `launchUrl(..., LaunchMode.externalApplication)` (`video_storyteller_screen.dart`; same in `instant_answer_screen.dart:82`). | **ABSENT** (external redirect only) |
| **Audio / TTS read-aloud** | Auto-spoken + manual; 3-tier neural stack (`api/tts/route.ts` Sarvam→Bhashini→Google); `omni-orb.tsx:520` **auto-speaks** every reply | `tts_service.dart` `speak()` → POST `/tts` (Sarvam→Google), plays MP3 via `flutter_sound`. Reachable as a **manual** `TTSPlayButton` on result screens (lesson, worksheet, quiz-play, exam-paper, rubric, training). **But no auto-speak anywhere** — the only `.speak()` caller in the whole app is the tap button (`tts_play_button.dart:70`). | **PARTIAL** (manual read-aloud present & reachable; **zero** automatic hear-back) |
| **STT / voice capture** | VAD auto-stop after 2.5s silence, spoken greeting, dual free+cloud STT, Indic-script retry (`microphone-input.tsx`, `voice-to-text.ts`) | `voice_input_widget.dart` + `stt_service.dart` → `/ai/voice-to-text` (Sarvam), opus/aac. **Tap-to-start / tap-to-stop dictation into a text field.** No VAD, no auto-stop, no greeting, no script-retry. It is a form-field mic, not hands-free capture. | **PARTIAL** (dictation only; not the hands-free web standard) |
| **Voice-note parent messages** | Web voice-message schema for parent comms + AI parent **calls** (Twilio, both regions) | Parent Message screen generates **text** (`/ai/parent-message`) shared via WhatsApp `Share.share` (`parent_message_screen.dart`) — no voice note. Teacher-to-teacher messaging has an `audio` message type + `audioUrl`/`audioDurationMs` fields (`message_models.dart:12,94`) but the conversation UI **neither records nor plays audio** (no player/recorder wiring in `conversation_screen.dart`; only a dictation mic). | **ABSENT** as a recorded voice note (schema stub only) |
| **AI parent voice CALL** (adjacent, worth noting) | Twilio parent-call loop (prod provider Twilio) | **PRESENT & wired:** `attendance_repository.dart` `initiateCall()` → `/attendance/call` (Twilio) + `getCallSummary()` (transcript + AI summary); invoked from `attendance_screen.dart:22,44,117`. The app triggers the server-side call; parent's phone rings. | **PRESENT** |
| **Realtime / streaming voice** (barge-in, full-duplex, Gemini Live) | Non-production spike only: `omni-orb-live.tsx` (imported nowhere) | No WebSocket, no Gemini Live, no streaming anywhere in `lib/`. Only Twilio server-callback comments. | **ABSENT** (parity: absent in web prod too) |
| **Image generation + in-app display** | Web image gen (~$0.04/image, most expensive flow) | **PRESENT:** `/ai/avatar` returns base64 PNG, `/ai/visual-aid` returns image, both shown in-app via `Image.memory` (`avatar_generator_screen.dart`, `visual_aid_creator_screen.dart`). | **PRESENT** (genuine parity point) |
| **Screen-context fusion** ("make it harder", VIDYA sees the form) | `hooks/use-vidya-form-sync.ts` publishes live form state to store; 7 tool pages | `VidyaRepository.chat` accepts `currentScreenContext`, but no caller populates it; no form-sync equivalent. | **ABSENT** |
| **Compound-intent chips** ("quiz AND worksheet") | `omni-orb.tsx:575-604` renders per-action confirm chips | None. Reachable chat has no actions at all. | **ABSENT** |
| **Conversational memory + teacher profile** | `jarvisStore.ts` (20-turn history, persisted profile) + `/vidya/session`,`/vidya/profile` | Endpoints coded in `vidya_repository.dart` (`getSession`/`getProfile`/`restoreSession`) — but only from the **unreachable** `vidya_chat_screen.dart`. Reachable `ChatScreen` keeps in-memory list only. | **ABSENT in the reachable path** |

---

## Direct answers to the three headline questions

**Where is the Omni-Orb on mobile?**
Nowhere the user can get to. There are two half-things and neither is the Orb:
1. A home-screen bar labeled "Ask VIDYA anything…" with a saffron **mic icon that is purely decorative** — the whole bar is a `GestureDetector` that opens `ChatScreen` (`home_screen.dart:386-389`). `ChatScreen` is a plain text chatbot hitting `/chat`, and its input-bar mic is `onPressed: () {}` — a **dead button** (`chat_screen.dart`).
2. `VidyaChatScreen` (`features/vidya/.../vidya_chat_screen.dart`) — the *actual* voice screen with `VoiceInputWidget`, `TTSPlayButton`, `VidyaActionCard`, hitting `/assistant`. It is registered at `/vidya-chat` but its **only** navigator, `VidyaFab`, is instantiated **nowhere** (`grep` for `VidyaFab(` returns only its own definition). It is orphaned code.
So: no global mount, no mic-first surface, no auto-speak, no auto-navigate/fill/submit. The Orb is **absent**; its richest replacement is **unreachable**.

**Where is video on mobile?**
There is no video. "Video Storyteller" (`video_storyteller_screen.dart`) calls `/ai/video-storyteller`, which returns **YouTube search-query strings** (`video_repository.dart` `VideoOutput.categories`). The screen renders them as a fake "script" with tappable links that open **external** YouTube (`launchUrl(..., externalApplication)`). Nothing is generated; nothing plays in-app. There is no `video_player`/`chewie`/`webview` dependency in `pubspec.yaml`. Its "Export PDF" is a no-op stub. **Video generation: absent. Video playback: absent (external redirect).**

**Where is audio on mobile?**
Read-aloud is real but **manual-only**. `tts_service.dart` calls `/tts` (Sarvam→Google) and plays MP3 through `flutter_sound`; it is reachable as a tap-to-play `TTSPlayButton` on the tool **result** screens (lesson, worksheet, quiz-play, exam-paper, rubric, training). What's missing is the web's **automatic** hear-back: the app **never** speaks a reply on its own — the sole `.speak()` caller in the codebase is the manual button (`tts_play_button.dart:70`). STT exists as tap-record dictation (`voice_input_widget.dart` → `/ai/voice-to-text`) with no VAD auto-stop and no greeting. So audio-out = **manual, partial**; audio-in = **dictation, partial**; the closed voice loop = **absent**.

---

## The reachability trap (the finding that matters most)

The mobile app looks far more voice-capable in a file listing than it is in the hand. The genuinely capable pieces — `/assistant` intent routing, action cards, voice input+output, session/profile memory, per-tool auto-fill — are all concentrated in `features/vidya/vidya_chat_screen.dart`, which **cannot be opened** because `VidyaFab` is never placed on any scaffold. The surface the user actually reaches from the home bar is `features/chat/chat_screen.dart`: a `/chat` text bot with a decorative dead mic and no TTS. A demo that only taps the home "Ask VIDYA" bar will therefore exercise the **weakest** path in the app and never touch the strong one. Any capability claim about mobile VIDYA must first answer: *is `VidyaFab` mounted?* Today it is not.

Secondary rot worth flagging: the tree carries **two parallel copies** of most feature screens (`lib/src/<feature>/…` legacy stubs vs. `lib/src/features/<feature>/…` real ones — e.g. two `vidya_chat_screen.dart`, the legacy one a bare `StatelessWidget`). The router imports the real ones; the legacy copies are dead weight that make the app look larger than it functionally is.

---

## The other Flutter tree (`sahayakai-flutter/`) — do not mistake it for the app

`sahayakai-flutter/` is a **Phase-T offline-rebuild spike**, not the shipping app: 4 files, 3 screens (`instant_answer`, `vidya_classifier`, `voice_to_text`) wrapping the `firebase_ai` Dart SDK for on-device Gemini Nano. Its own README and `services/sahayakai_ai.dart` state hybrid inference is **staged but disabled** (`_hybridInferenceAvailable = false`) because `firebase_ai 2.3.0` doesn't expose the flag. It has no tools, no Omni-Orb, no video, no TTS read-aloud UI. It is a parity/offline experiment; the capability census above is against `sahayakai_mobile`, which is the actual app.