# PILLAR BUILD PLAN — Full Pillar Parity, Voice-First

**Status:** MASTER PLAN for the autonomous build loop · **Owner:** product + design lead (synthesis)
**Design system (locked, reuse only):** `docs/flutter/design/PREMIUM_DESIGN_SPEC.md` — "The Ledger ·
Ivory & Ink, Saffron & Pine." No new visual language ships in this phase. Every screen composes the
already-built `AppCard` / `DocumentSheet` / `EditorialSectionHeader` / `IconWell` / `AppSegmented` /
`ScoreRing` / `AiText` / `EmptyView` / `ErrorView` / `AppSkeleton` / `AppBadge` / `LabeledField` /
`PrimaryButton` / `SecondaryButton` / `PressScale` / `ToolScaffold` / `AppMotion` primitives.
**Source specs (read in full — this plan integrates, it does not replace):**
- `SPEC_voice_vidya.md` (Pillars 01+02, the soul)
- `SPEC_pillars_ia.md` (the 6-pillar map + navigation)
- `SPEC_parent_hotline.md` (Pillar 03)
- `SPEC_staffroom_inbox.md` (Pillars 04+05)
**Backend:** `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main` — **READ-ONLY.** This plan *names*
the routes it consumes; where only a Next server action exists (community/messages), it names the thin
REST wrapper the backend team must add and builds the Flutter side against the documented shape behind
a feature flag.

> **The one sentence:** the app must stop being a form-first tool grid and become a **voice-first
> co-teacher** — it opens on a nearly-empty ivory page with one large saffron seal mic, the teacher
> speaks in their own language, and VIDYA prepares the work. Everything else (hotline, staffroom,
> inbox, the remaining tools) hangs off that spine.

---

## PART 1 — THE VOICE-FIRST THESIS (build unit #1)

### 1.1 Why this is unit #1
The founder's north star is one sentence: *"I just speak in Kannada, and it creates the plan for me."*
The shipped Flutter app is **form-first and missed voice entirely** — it has 8 typed tool forms, a tile
grid home, and a Create-palette tab. The web app's soul is the globally-mounted **OmniOrb** mic +
**VIDYA** brain that lives on every page. **Voice-first home + VIDYA is therefore the first thing built,
before any other pillar**, because it re-centers the whole product and every later unit threads through
it (voice into tools, voice into the hotline compose step, voice notes in the inbox).

### 1.2 The home — "The Almanac Speaks"
`lib/features/vidya/presentation/vidya_home_screen.dart` **replaces** the current form-first
`dashboard_screen.dart` as `Routes.home`.

- **Ground:** warm ivory paper (`AppGradients.lightPaper` / dark vignette), a seamless transparent app
  bar (Seal mini + wordmark). Mostly **empty**.
- **Idle masthead (fades out once a conversation starts):** saffron `eyebrow` "YOUR CO-TEACHER" → a
  time-aware Fraunces greeting ("Good morning, Teacher.") → a `lead` deck "Just speak — in your language
  — and I'll prepare it." → a 2px×48dp saffron rule. Under it, a hairline-ruled row of **rotating prompt
  suggestions** drawn from the web's `pillar.*.rotating` strings (dignified, not marketing copy).
- **The hero — the Seal Mic** (`seal_mic.dart`): one large (128dp idle) circular **saffron wax-seal**
  press control at the optical centre, `brandSaffron #FF9933` face + 2px `brandBrass #B08D57` ring + a
  Lucide `mic` glyph in `onPrimary`, lit by `AppShadows.ctaGlowLight`. It is an authored signature
  moment, **not** a Material FAB. Keeps saffron < 10% of the screen (the single focal element).
- **Conversation register (grows upward as turns land):** each turn is a **document block, never a chat
  bubble** — the teacher's transcript in `AppCard(inset)` with an overline "YOU SAID", VIDYA's reply in
  `AppCard(flat)` + a 3px saffron `accentBar` + a section tick, all body text through the existing
  `AiText` widget (Indic matra-safety, line-height 1.7). Each block reveals via `inkSettle`. A compound
  intent renders as a `Wrap` of confirm chips.
- **Below the fold (scroll):** `EditorialSectionHeader "YOUR TEACHING TOOLS"` → the `kToolRegistry` tool
  register (Prep desk is one scroll away, so the home is never a dead end). Optional real-data summary
  strip, hidden at zero.

### 1.3 The voice interaction state machine (two coupled machines, ported exactly from the web)
```
CAPTURE (MicStatus):
  idle ──tap──▶ greeting(first press only, TTS "Good morning, Teacher…")
             ──▶ initializing ──▶ recording ──(VAD trailing-silence / tap / 30s cap)──▶ processing ──▶ idle
                                        │ tap again while recording = cancel (forceReset)

CONVERSATION (after processing yields a transcript):
  transcript ─▶ addMessage(user) ─▶ POST /api/assistant ─▶ addMessage(model) + tts.speak(response)
                                          │
             ┌────────────────────────────┼────────────────────────────┐
        0 actions                     1 action                     2–3 plannedActions
      (speak only)          auto-navigate + prefill the tool      render confirm chips (tap each)
```
State→label (l10n): `greeting/recording`="I'm listening…", `initializing`="Getting ready…",
`processing`="Thinking…", `idle`="Tap to speak". Seal-mic visual per state: idle breathing halo →
listening amplitude rings → thinking arc spinner → speaking 3-bar equaliser. **Reduce-motion**
(`context.motionEnabled == false`) collapses every state to a static composed frame.

The pipeline is **capture → STT → VIDYA → TTS → navigate+prefill → persist**, consuming:
`POST /api/ai/voice-to-text` (multipart WAV), `POST /api/assistant`, `POST /api/tts` (base64 mp3),
`GET/POST /api/vidya/session`, `GET/POST /api/vidya/profile`. Ported guards: `flow` enum guard
(closed 10-value set — drop unknowns so a hallucinated flow never 404s), fresh-classification windowing
(5 min + same-path before carrying `chatHistory`), `MIN_AUDIO_BYTES` reject, transcription-refusal
string filter, and **never persist an utterance's `language` to the profile** (the "form shows English,
output Hindi" bug).

### 1.4 The mobile voice stack (exact plugins — the #1 build sub-unit)
Four new dependencies (the current `pubspec.yaml` has **none** of the audio stack):

| Plugin | Version | Role | Why this one |
|---|---|---|---|
| `record` | `^5.1.2` | Capture → **WAV 16 kHz mono** + live `onAmplitudeChanged` stream | Exposes amplitude (drives the listening ring), lets us choose the **encoder** (WAV unlocks the Sarvam Saaras v3 Indic fast path — see below), returns a plain file to multipart-POST. Not `flutter_sound`/`mic_stream`. |
| `just_audio` | `^0.9.42` | Playback of base64-mp3 TTS via a custom `StreamAudioSource` | Backend returns **base64 mp3 bytes, not a URL**; `just_audio` plays bytes in-memory with no temp file and integrates with `audio_session` for clean ducking. (`audioplayers` `BytesSource` is a viable fallback.) |
| `permission_handler` | `^11.3.1` | Runtime mic permission + settings deep-link | Standard; request at the first mic tap, dignified `EmptyView`+"Open settings" on permanent denial. |
| `audio_session` | `^0.1.21` | Configure OS audio session (`speech()`, duck others) | `just_audio` peer; makes TTS interrupt/duck correctly. |

**The load-bearing format decision:** record **`AudioEncoder.wav`, 16 kHz, mono**. The web is stuck with
opus (all a browser emits) and falls to the slower Gemini STT path; Flutter is not stuck. Sarvam Saaras
v3 runs server-side **only if the uploaded MIME matches `audio/(mpeg|mp3|wav)`**, so WAV unlocks the
cheap, Indic-tuned fast path for Kannada/Bengali/Tamil. Multipart the file as field `audio`
(filename `recording.wav`, contentType `audio/wav`) + `expectedLanguage` = the app's 2-letter locale.
Client-side VAD ports the web thresholds (speech onset, 2.5 s trailing-silence auto-stop, 5 s
initial-silence, 30 s hard cap, `<2000` byte reject) into a `VoiceCaptureController`.

**Permissions:** Android `RECORD_AUDIO` in `AndroidManifest.xml`; iOS `NSMicrophoneUsageDescription`
in `Info.plist` (localised across 11 languages).

---

## PART 2 — THE PILLAR MAP + GAP + REVISED NAVIGATION

### 2.1 The six pillars — exists vs missing
| # | Pillar (id) | Lucide | In Flutter today | The gap |
|---|---|---|---|---|
| 01 | **Prep desk** (`prep-desk`) | `NotebookPen` | **Partial** — 8 tools as typed forms | **Voice-first entry on every tool**; 5 tools not built (Visual Aid, Content Creator, Video Storyteller, Virtual Field Trip, Assessment Scanner) |
| 02 | **AI co-teacher / VIDYA** (`ai-co-teacher`) | `Sparkles` | **Absent (100%)** | The entire VIDYA surface: mic, conversation, `/api/assistant`, session persistence, NAVIGATE_AND_FILL, TTS. **The #1 gap.** |
| 03 | **Parent hotline** (`parent-hotline`) | `PhoneCall` | **Text-only** (`parent_message` draft exists) | The real **AI voice call**: outreach → call → poll → summary `DocumentSheet` |
| 04 | **Staffroom** (`staffroom`) | `Users` | **Absent** | Groups, unified feed, posts, connections, directory, staff-room chat |
| 05 | **Pro inbox** (`pro-inbox`) | `Inbox` | **Absent** | Conversations, thread, notifications; connection-gated by Pillar 04 |
| 06 | **Operating system** (`operating-system`) | `LayoutGrid` | **Cross-cutting, partial** (i18n present) | Board/NCERT defaults, plan/usage, privacy — expressed as the **Me** hub, not a tab |

Plus a cross-cutting **Notifications** surface (`/notifications`) that powers the badges for 04/05.

### 2.2 Gap ranked for the loop (highest leverage first)
1. **VIDYA voice + voice-first home** (Pillar 02) — the soul.
2. **Voice-to-text on prep-desk tools** (Pillar 01) — makes "just speak" real per-tool.
3. **Parent hotline voice call** (Pillar 03) — the demoable "wow", backend already live.
4. **Staffroom + Pro inbox + Notifications** (04/05) — the network; needs the transport decision.
5. **Remaining 5 prep-desk tools** — copy the lesson-plan/DocumentSheet reference.
6. **OS framing** (06) — board defaults, plan/usage, privacy in the Me hub.

### 2.3 Revised premium navigation (expresses the pillars — NOT a flat 6-tab bar)
A 6-tab bottom bar is a cheap-utility tell and breaks the ≥48dp rhythm at 360dp. Instead:

- **Home = Pillar 02** — the near-empty voice-first VIDYA canvas (one large seal mic), with the Pillar 01
  tool register one scroll below.
- **Bottom nav = four destinations** (keep the floating bar, radius 20, `surface`, `e3`, active saffron
  pill):

  | Tab | Lucide | Route | Fronts |
  |---|---|---|---|
  | **Home** | `mic` | `/` | 02 VIDYA canvas + 01 tool register |
  | **Network** | `users` | `/staffroom` | 04 Staffroom + 05 Pro inbox (`AppSegmented` *Staffroom · Inbox*) + Notifications bell |
  | **Library** | `library` | `/my-library` | saved artifacts (01 outputs) |
  | **Me** | `user` | `/me` | 06 OS hub: profile · board & language · plan & usage · settings · privacy |

- **Create is absorbed into the mic** — speaking *is* creating. The old Create-palette tab (the
  form-first artifact the founder reacts against) is retired; a `⌘K`-style "type instead" affordance
  stays reachable via long-press on the mic.
- **Parent hotline (03) is not a tab** — it's reached from Home/VIDYA and a class roster, mirroring the
  web where it lives under Attendance. Deliberate action, not a browse destination.
- **Network merges 04+05** because Pillar 05 is connection-gated by Pillar 04 — one mental model
  ("my professional network"). Notifications is the bell in that screen's app bar.

### 2.4 Route additions (`lib/core/router/routes.dart`, registered in `app_router.dart`)
```
Routes.parentHotline = '/parent-hotline'          // roster + call launcher (Pillar 03)
Routes.staffroom     = '/staffroom'               // feed + groups + directory (Pillar 04)
Routes.groupDetail   = '/staffroom/group/:groupId'
Routes.teacherProfile= '/staffroom/teacher/:uid'
Routes.inbox         = '/inbox'                    // Pillar 05
Routes.conversation  = '/inbox/:conversationId'
Routes.notifications = '/notifications'            // cross-cut
Routes.me            = '/me'                       // Pillar 06 hub
// Pillar 01 new tools:
Routes.visualAid, Routes.videoStoryteller, Routes.virtualFieldTrip,
Routes.contentCreator, Routes.assessmentScanner
```
Every new *tool* route also gets a `kToolRegistry` entry (`lib/shared/domain/tool_registry.dart`) so it
appears on Home + palette automatically. VIDYA's `flow → Routes` map reuses these ids (map
`quiz-generator → Routes.quizGenerator`).

---

## PART 3 — THE ORDERED BUILD QUEUE (for the autonomous loop)

Branch from `develop`. One commit per unit, explicit `git add` paths, **never push**. Per-unit
guardrails (see PART 5) apply to **every** unit. Firebase-handoff-gating is called out per unit: the UI,
voice stack, DTOs, controllers and plumbing can all be **built and unit-tested now**; live behavior
(real STT/TTS, VIDYA auth, calls, community/inbox realtime) can only be **verified once Firebase auth is
wired**, so those units ship behind feature flags degrading to `EmptyView`/signed-out states.

### Block A — Voice-first home + VIDYA (Pillar 02 + 01 entry) — **THE SOUL, FIRST**
- **U-V1 — Voice stack + permissions.** Add the 4 deps (record/just_audio/permission_handler/
  audio_session); Android/iOS permission entries; `VoiceCaptureController` (record→WAV 16k mono, amplitude
  stream, ported VAD thresholds); `TtsPlayer` (just_audio + `_Base64Mp3Source` + audio_session, cancel
  semantics).
  - *Files:* `pubspec.yaml`, `android/app/src/main/AndroidManifest.xml`, `ios/Runner/Info.plist`,
    `lib/shared/media/voice_capture_controller.dart`, `lib/shared/media/tts_player.dart`.
  - *Consumes:* (native mic/audio only; no backend).
  - *Accept:* VAD timers + base64 source unit-tested with fakes (no real mic/audio in CI); analyze 0.
  - *Firebase-gated:* NO (buildable + testable now; real STT quality needs live backend).
- **U-V2 — Backend repos + DTOs.** `VoiceToTextRepository` (multipart), `VidyaRepository`
  (`AssistantRequest`/`AssistantResponse`/`VidyaAction`/`PlannedAction` DTOs + `flow` enum guard),
  `TtsRepository`, `VidyaSession`/`VidyaProfile` repos — all via the existing `ApiClient`
  (`baseUrl https://sahayakai.com`, `AuthInterceptor` attaches Bearer).
  - *Files:* `lib/features/vidya/data/*_repository.dart`, `.../dto/*.dart` (+ `.g.dart`).
  - *Consumes:* `POST /api/ai/voice-to-text`, `POST /api/assistant`, `POST /api/tts`,
    `GET/POST /api/vidya/session`, `GET/POST /api/vidya/profile`.
  - *Accept:* golden-decode tests against the exact JSON shapes in the voice spec; analyze 0.
  - *Firebase-gated:* partial — decode/guard logic testable now; live calls 401 until real auth.
- **U-V3 — `VidyaController` (the single brain).** State machine, conversation/session/profile state,
  fresh-classification windowing, `LANG_TO_BCP47` + `normaliseVidyaLanguage`, never-persist-language
  guard. Top-level Riverpod provider (survives navigation → VIDYA on every screen).
  - *Files:* `lib/features/vidya/presentation/vidya_controller.dart`.
  - *Consumes:* U-V1 + U-V2.
  - *Accept:* pure-Dart state tests with fake repos (all 5 transitions, the guards).
  - *Firebase-gated:* NO (fakes).
- **U-V4 — Seal Mic widget.** `seal_mic.dart` — geometry, 5 states, breathing/listening/thinking/
  speaking motion, reduce-motion path, `PressScale`, `Semantics`.
  - *Files:* `lib/features/vidya/presentation/widgets/seal_mic.dart`.
  - *Accept:* goldens at 360/800 light+dark + reduce-motion; analyze 0.
  - *Firebase-gated:* NO.
- **U-V5 — VIDYA Home screen.** `vidya_home_screen.dart` — masthead + conversation register (document
  blocks) + anchored seal + compound chips. **Replaces the form-first home** as `Routes.home`.
  - *Files:* `lib/features/vidya/presentation/vidya_home_screen.dart`, `.../widgets/conversation_block.dart`,
    `lib/core/router/app_router.dart` (home wiring), `lib/features/dashboard/presentation/app_shell.dart`
    (nav re-label).
  - *Consumes:* U-V3.
  - *Accept:* goldens idle / mid-conversation / compound-chips; Indic probes (bn/ta/ml); light+dark.
  - *Firebase-gated:* NO for UI; live conversation needs auth.
- **U-V6 — Thread voice INTO tools.** Nav+prefill dispatcher; `lesson_plan_screen` reads query-param
  prefill (reference impl); enum-guard + drop-unknown. Then inline field mic on `LabeledField` (STT-only).
  - *Files:* `lib/features/vidya/presentation/vidya_nav_dispatcher.dart`,
    `lib/features/lesson_planner/presentation/lesson_plan_screen.dart` (prefill),
    `lib/shared/widgets/labeled_field.dart` (optional trailing mic).
  - *Consumes:* U-V3 + the tool routes.
  - *Accept:* dispatcher unit tests (each flow→route, unknown dropped); lesson-plan prefill widget test.
  - *Firebase-gated:* NO.
- **U-V7 — Persistence + presence.** Firestore restore on login (session+profile), fire-and-forget turn
  sync, bottom-nav VIDYA affordance + optional mini-seal on tool screens (scroll-idle auto-hide),
  `registerScreenContext` on each tool form.
  - *Files:* `lib/features/vidya/data/vidya_session_repository.dart` (restore),
    tool screens (`registerScreenContext` hook), `app_shell.dart`.
  - *Consumes:* `/api/vidya/session`, `/api/vidya/profile`.
  - *Accept:* restore/sync unit tests with fakes.
  - *Firebase-gated:* YES for live restore (needs real auth); plumbing testable now.

### Block B — Parent hotline (Pillar 03)
- **U-PH1 — Data + domain.** DTOs + repository for `outreach`/`call`/`call-summary`/`outreach-latest`;
  typed error mapping (`premiumRequired`/`noParentPhone`/`dedup(retryAfterSeconds)`/`unsupportedLanguage`);
  domain models mirroring `src/types/attendance.ts`. Reuse `parentMessageRepositoryProvider` for the draft.
  - *Files:* `lib/features/parent_hotline/data/*`, `.../domain/*`.
  - *Consumes:* `POST /api/attendance/outreach`, `POST /api/attendance/call`,
    `GET /api/attendance/call-summary`, `GET /api/attendance/outreach-latest`, `POST /api/ai/parent-message`.
  - *Accept:* decode + error-branch unit tests against captured JSON.
  - *Firebase-gated:* YES for live (routes 401 + plan-gate 403 until real auth); decode testable now.
- **U-PH2 — Controller + polling.** `HotlineStage` machine (`pickStudent → reason → compose → review →
  calling → summary`) + the exact web poll discipline (3s then 5s, ~5min ceiling; terminal-without-summary
  3s×~8; cancel on dispose; resume via `outreach-latest`).
  - *Files:* `lib/features/parent_hotline/presentation/parent_hotline_controller.dart`.
  - *Accept:* transition tests (fresh / resume-initiated / resume-completed / dedup-429 /
    unsupported-language / no-phone).
  - *Firebase-gated:* NO (fakes).
- **U-PH3 — Stages 1–4 (pick → reason → compose → review).** Reason cards, reason-aware evidence panel,
  drafted-message review block, sticky decision bar (Call enabled only when callable; always Copy-for-
  WhatsApp).
  - *Files:* `lib/features/parent_hotline/presentation/parent_hotline_screen.dart` + stage widgets.
  - *Consumes:* U-PH1/PH2 + `GET /api/performance/student/{id}`.
  - *Accept:* widget tests per stage; callability mirrors `TWILIO_LANGUAGE_MAP`.
  - *Firebase-gated:* NO for UI.
- **U-PH4 — Stage 5 (calling).** Honest breathing waiting state (haloed `phone-call`, live status + tabular
  turn count, "you can leave" copy). No fake progress bar.
  - *Accept:* golden light+dark + reduce-motion; poll-cancel-on-leave test.
  - *Firebase-gated:* live status needs a real call; UI testable now.
- **U-PH5 — Stage 6 (summary), the hero.** Full `DocumentSheet` + Ink-settle reveal (masthead + sentiment/
  duration/turns badges, the 6 sections, YOUR ACTION ITEMS primary-toned, collapsible transcript) + all
  terminal states (manual/busy/no-answer/failed/poll-exhausted).
  - *Accept:* goldens 360/800 light+dark with Indic probes; every terminal state rendered (never a hung
    spinner).
  - *Firebase-gated:* NO for UI (renders decoded `CallSummary`).

### Block C — Staffroom + Pro inbox + Notifications (Pillars 04+05) — transport-gated
- **U-SI0 — Transport spike (blocks all of Block C).** Resolve the split: add `firebase_core` +
  `cloud_firestore` (+ `firebase_database` for presence) and init from Firebase config for the **live
  reads**; request thin REST wrappers (`/api/community/*`, `/api/messages/*`, `/api/connections/*`,
  `/api/notifications/*`) over the existing server-action logic for **every write + server-derived read**
  (a **backend task** — READ-ONLY here). Port `buildDirectConversationId` (`[a,b]..sort()` join `_`) and
  all DTOs. Gate everything behind `kStaffroomEnabled` / `kProInboxEnabled = false`.
  - *Files:* `pubspec.yaml`, `lib/core/firebase/*`, `lib/features/staffroom/data/dto/*`,
    `lib/features/inbox/data/dto/*`.
  - *Firebase-gated:* **YES — this is the gate.** Nothing in Block C verifies live until Firebase is wired.
- **U-SI1 — Pro Inbox realtime core.** `inbox_screen` + `conversation_thread_screen` + paginated-messages
  provider (live tail `onSnapshot(limitToLast 30)` + static `getDocs(endBefore)`) + mark-read + unread
  badges. Messages as **ruled ledger blocks, never bubbles**; `resource` messages reuse `DocumentSheet`
  masthead grammar with an "Open" route back into the tool.
  - *Consumes:* Firestore `conversations`/`messages` (live) + REST wrappers `getOrCreateDirectConversation`,
    `sendMessage`, `markConversationRead`.
  - *Accept:* skeleton/empty/error states; `clientMessageId` idempotency; DM-gate copy; goldens with Indic
    probes at textScale 1.3.
  - *Firebase-gated:* YES.
- **U-SI2 — Staffroom home + Group detail + Unified feed + optimistic likes.**
  - *Consumes:* REST wrappers `ensureUserGroups`/`getMyGroups`/`getUnifiedFeed`/`getGroupPosts`/
    `likeGroupPost`/`getRecommendedTeachers`/`getLibraryResources`.
  - *Firebase-gated:* YES (writes via wrappers, needs auth).
- **U-SI3 — Staff Room chat (realtime) + persona-pulse timer + group chat.**
  - *Consumes:* Firestore `community_chat` / `groups/{id}/chat` (live `onSnapshot limitToLast 100`) +
    `POST /api/community/persona-pulse` (503 = stop) + REST `sendChatMessage`/`sendGroupChatMessage`.
  - *Firebase-gated:* YES.
- **U-SI4 — Directory + Profile + connection-request lifecycle (the DM gate).**
  - *Consumes:* REST `getAllTeachers`/`getPublicProfile`/`sendConnectionRequest`/`accept`/`decline`/
    `disconnect`/`getMyConnectionData`. **PII stays server-side** — never read `users/*` directly.
  - *Firebase-gated:* YES.
- **U-SI5 — Notifications screen + connect-request inline actions + deep links.**
  - *Consumes:* REST `getNotifications`/`markNotificationAsRead`/`markAllAsRead`; live badge via
    `onSnapshot(notifications recipientId==me && isRead==false)`.
  - *Firebase-gated:* YES.
- **U-SI6 — Firebase-gated tail: presence (RTDB) + FCM push parity.** Hard handoff wall
  (google-services.json, APNs, RTDB rules). Ship the pillars without it first.
  - *Consumes:* RTDB `presence/{uid}/online` (`onValue`), `firebase_messaging`.
  - *Firebase-gated:* YES (hardest wall).

### Block D — Remaining prep-desk tools + OS hub (Pillars 01 tail + 06)
- **U-PD1..U-PD5 — the 5 missing tools.** Visual Aid, Content Creator, Video Storyteller, Virtual Field
  Trip, Assessment Scanner — each **copies the lesson-plan/DocumentSheet reference** (filled form →
  `DocumentSheet` result; Visual Aid → image card; Assessment Scanner → multipart upload + `ScoreRing`).
  Add each to `kToolRegistry` + a `Routes` const + `app_router` entry.
  - *Consumes:* `POST /api/ai/visual-aid`, `/api/ai/content`, `/api/ai/video-storyteller`,
    `/api/ai/virtual-field-trip`, `/api/ai/assessment-scanner` (multipart).
  - *Firebase-gated:* NO for UI (auth 401 until real auth, like every tool).
- **U-OS1 — The Me / Operating-system hub.** Rebuild Me: profile · **board & language defaults** (feed
  board into tool params) · plan & usage (`/api/usage`, PlanBadge/UsageDisplay parity) · settings ·
  privacy. Do **not** claim offline GA (`project_offline_status`).
  - *Files:* `lib/features/profile/presentation/me_screen.dart`, `lib/features/settings/*`.
  - *Consumes:* `GET /api/usage`.
  - *Firebase-gated:* partial.

**Ordered summary:** Block A (U-V1→U-V7) → Block B (U-PH1→U-PH5) → Block C (U-SI0→U-SI6) → Block D
(U-PD1→U-PD5, U-OS1). Voice-first home + VIDYA first; parent hotline; staffroom; pro inbox; then
voice-into-tools was folded into Block A (U-V6) and the prep-desk voice entry rides on the same
`VoiceCaptureController`.

---

## PART 4 — THE MOBILE VOICE + REALTIME STACK (exact deps + permissions)

### 4.1 Voice / audio (Block A)
```yaml
  record: ^5.1.2             # capture → WAV 16kHz mono + onAmplitudeChanged (listening ring)
  just_audio: ^0.9.42        # playback of base64-mp3 TTS via a custom StreamAudioSource
  permission_handler: ^11.3.1 # runtime mic permission + openAppSettings()
  audio_session: ^0.1.21     # OS audio session (speech(), duck others) — just_audio peer
```
- **Capture:** `RecordConfig(encoder: AudioEncoder.wav, sampleRate: 16000, numChannels: 1)` → the Sarvam
  fast path. Multipart field `audio` (`recording.wav`, `audio/wav`) + `expectedLanguage`.
- **Playback:** one reusable `just_audio` player; `_Base64Mp3Source extends StreamAudioSource`
  (`contentType: 'audio/mpeg'`); `tts.cancel()` stops the previous clip before the next `speak()`.

### 4.2 Realtime (Block C) — added at U-SI0, Firebase-gated
```yaml
  firebase_core: <pinned>        # init from Firebase config
  cloud_firestore: <pinned>      # onSnapshot: inbox list, thread tail, staff-room/group chat, unread badges
  firebase_database: <pinned>    # RTDB onValue: presence dot only (U-SI6)
  firebase_messaging: <pinned>   # FCM push parity (U-SI6, handoff-walled)
```
Live reads become Riverpod `StreamProvider`s mirroring the web's `onSnapshot`/`onValue`. Every write and
every server-derived read goes through a **thin REST wrapper** over the existing server-action logic
(backend task) reached via the existing Dio `ApiClient` — Flutter never reimplements authz/validation.

### 4.3 Permissions
- **Android** (`AndroidManifest.xml`): `RECORD_AUDIO` (mic); `INTERNET` already present. FCM adds
  `POST_NOTIFICATIONS` (Android 13+) at U-SI6.
- **iOS** (`Info.plist`): `NSMicrophoneUsageDescription` (localised ×11). APNs entitlement at U-SI6.
- Request mic at the **first mic tap** (`Permission.microphone`); permanent denial → dignified
  `EmptyView` + `SecondaryButton "Open settings"` (`openAppSettings()`), never a raw error dialog.

### 4.4 Auth reality (why so much is Firebase-gated)
The foundation-v1 token provider is stubbed (`_noToken` in `lib/core/auth/`), so against the real backend
every authed route (`/api/assistant`, `/api/tts`, `/api/ai/voice-to-text`, all attendance + community +
messages routes) returns `401` until real Firebase auth is wired. Therefore: **build + unit-test the UI,
the voice stack, the DTOs, the controllers and the plumbing now** (fakes, golden tests, decode tests);
**gate live verification** (real STT/TTS round-trips, VIDYA conversation, parent calls, community/inbox
realtime) behind the Firebase handoff. Each gated unit degrades to a signed-out `EmptyView` /
`kStaffroomEnabled=false` / `kProInboxEnabled=false` state until then.

---

## PART 5 — UNIVERSAL PER-UNIT GUARDRAILS (every unit, no exceptions)
1. `flutter analyze` = **0 issues**.
2. `scripts/token_guard.sh` = **PASS** (no raw hex/curves/radii; tokens only).
3. The existing suite stays green (**771 tests** at pillar-phase start — logic/widget/behavior unchanged),
   and each unit **adds** its own tests (decode/state/widget/golden as noted).
4. Golden tests re-baseline at **360dp + 800dp, light + dark**, with **Indic probe strings**
   (Bengali/Tamil/Malayalam) showing **zero clipped matras** at textScale 1.3 — all body text via `AiText`.
5. **Accessibility + dignity:** every target ≥48dp; WCAG AA contrast; **Lucide-only, no emoji**; teacher-
   tone copy (no aggressive marketing about teachers/parents).
6. **Ledger reuse only:** no new colors/curves/radii/widgets; compose the locked shared primitives;
   saffron surface **< 10%** of any screen.
7. **Motion budget:** ≤3 curves, ≤420ms; every animation site checks `context.motionEnabled` and degrades
   to the final composed frame under reduce-motion.
8. **Auth pattern:** Firebase ID token → `Authorization: Bearer` → server `x-user-id`; handle
   `401` / `403 PREMIUM_REQUIRED` uniformly (existing auth-guard pattern).
9. Branch from `develop`; one commit per unit; explicit `git add` paths; **never push**.

---

**Files:** `docs/flutter/pillars/PILLAR_BUILD_PLAN.md` (this) · `docs/flutter/pillars/PILLAR_BUILD_STATE.json`
