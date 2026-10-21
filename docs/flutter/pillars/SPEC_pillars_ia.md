# SPEC — Pillars & Information Architecture (Flutter)

**Status:** DRAFT for the autonomous build loop · **Lens:** Pillar / Information Architecture
**Design system:** reuse `docs/flutter/design/PREMIUM_DESIGN_SPEC.md` ("The Ledger · Ivory &
Ink") — every screen below composes AppCard / DocumentSheet / EditorialSectionHeader / IconWell
/ AppSegmented / ScoreRing / the ivory-ink tokens / Fraunces+Inter / the 3-curve motion set.
Nothing here introduces a new visual language; it maps product surface onto the one we have.

**The thesis (founder):** the product's soul is **voice-first** — *"I just speak in Kannada,
and it creates the plan for me."* The Flutter app currently ships **only Pillar 01, form-first,
and missed voice entirely.** This spec re-centers the app on the six pillars and on VIDYA voice
as the home surface.

Source of truth read for this spec:
- Pillar taxonomy: `src/components/landing/pillar-data.ts` (6 ids + Lucide glyphs)
- Canonical pillar copy (all 11 langs): `src/context/language-context.tsx` `pillar.*.{name,desc,rotating}`
- Web nav: `src/components/app-sidebar.tsx` (desktop intent-groups), `src/components/mobile-bottom-nav.tsx` (Home/Create/Library/Me), `src/components/omni-orb.tsx` (VIDYA)
- Backend routes under `src/app/api/**` and server actions under `src/app/actions/**`
- Current Flutter: `lib/features/**`, `lib/shared/domain/tool_registry.dart`, `lib/core/router/{routes,app_router}.dart`

---

## 0. The six pillars at a glance

| # | Pillar (id) | Lucide | One-line (from `pillar.*.desc`, English) | In Flutter today? |
|---|---|---|---|---|
| 01 | **Prep desk** (`prep-desk`) | `NotebookPen` | Voice-first lesson prep · 7 AI tools · 11 languages | **Partial** — 8 tools as forms; **no voice-first entry** |
| 02 | **AI co-teacher** (`ai-co-teacher`) | `Sparkles` | VIDYA · persistent pedagogy coach on every page | **Missing entirely** |
| 03 | **Parent hotline** (`parent-hotline`) | `PhoneCall` | AI voice calls to parents in their own language | **Missing** (only the text draft tool exists) |
| 04 | **Staffroom** (`staffroom`) | `Users` | India's first structured professional teacher network | **Missing** |
| 05 | **Pro inbox** (`pro-inbox`) | `Inbox` | Purpose-built professional messaging, structured + searchable | **Missing** |
| 06 | **Operating system** (`operating-system`) | `LayoutGrid` | PWA · 28 state boards · works on cheapest Android | **Cross-cutting** — partly present (i18n, boards in tool params); not expressed as a surface |

Naming rule for Flutter: reuse the exact `pillar.<id>.name` strings, add them as l10n keys
(`pillarPrepDeskName`, `pillarAiCoTeacherName`, …) across all 11 ARBs so pillar labels translate.

---

## 1. PILLAR MAP (sub-features → web surface → backend → data model)

### Pillar 01 — Prep desk  ·  `NotebookPen`  ·  voice-first lesson prep

**Sub-features (the tool set).** Web sidebar groups these under Create / Assess / Engage / Ask;
the pillar rolls them up. Registry-driven in Flutter via `kToolRegistry`.

| Tool | Web page | Backend route | Method | Request (key fields) | Response (key fields) | In Flutter |
|---|---|---|---|---|---|---|
| Lesson Plan | `/lesson-plan` | `/api/ai/lesson-plan` (+ `/stream`) | POST | `topic, gradeLevel, subject, language, board?, duration?` | 5E plan blocks (`engage/explore/explain/elaborate/evaluate`), materials, objectives | ✅ `lesson_planner` |
| Quiz Generator | `/quiz-generator` | `/api/ai/quiz` (`/health`) | POST | `topic, gradeLevel, subject, language, numQuestions, difficulty` | `questions[]{stem, options[], answer, explanation}` | ✅ `quiz_generator` |
| Instant Answer | `/instant-answer` | `/api/ai/instant-answer` | POST | `question, language, gradeLevel?` | `answer` (AiText markdown) | ✅ `instant_answer` |
| Worksheet Wizard | `/worksheet-wizard` | `/api/ai/worksheet` | POST | `topic, gradeLevel, subject, language, types[]` | worksheet sections + answer key | ✅ `worksheet_wizard` |
| Rubric Generator | `/rubric-generator` | `/api/ai/rubric` | POST | `assignment, gradeLevel, criteriaCount, language` | `criteria[]{name, levels[]}` (grid → ScoreRing/table) | ✅ `rubric_generator` |
| Exam Paper | `/exam-paper` | `/api/ai/exam-paper` (`/stream`) | POST | `subject, gradeLevel, board, totalMarks, sections, language` | sections with mark weights, blueprint | ✅ `exam_paper` |
| Teacher Training | `/teacher-training` | `/api/ai/teacher-training` | POST | `topic, language, focus` | module / micro-course text | ✅ `teacher_training` |
| Visual Aid Designer | `/visual-aid-designer` | `/api/ai/visual-aid` | POST | `concept, gradeLevel, style, language` | image asset(s) + caption | ❌ (P2 in web sidebar "Engage") |
| Content Creator | `/content-creator` | `/api/ai/content` (`/api/content`) | POST | `type, topic, language` | long-form content | ❌ |
| Video Storyteller | `/video-storyteller` | `/api/ai/video-storyteller` | POST | `topic, gradeLevel, language` | video/story script + scenes | ❌ |
| Virtual Field Trip | `/virtual-field-trip` | `/api/ai/virtual-field-trip` | POST | `destination, gradeLevel, subject, language` | trip narrative + stops | ❌ |
| Assessment Scanner | `/assessment-scanner` | `/api/ai/assessment-scanner`, `/api/assessment-scanner/*` | POST (multipart) | `image`(File), `rubric?, gradeLevel` | OCR + graded feedback | ❌ (partial: `assess_assignment` is the assignment grader) |
| Assess Assignment | `/assess-assignment` | `/api/ai/assess-assignment` | POST | `submission, rubric, gradeLevel, language` | score + criteria feedback (ScoreRing) | ✅ `assess_assignment` |

- **Auth model (all AI routes):** middleware verifies Firebase ID token → injects `x-user-id`
  header. Client sends `Authorization: Bearer <idToken>`. `withPlanCheck('<tool>')` wraps each
  handler (usage/entitlement gate). 401 on missing identity; 403 `PREMIUM_REQUIRED` on plan gate.
- **The voice-first gap (the founder's core complaint):** every web tool page carries a
  microphone affordance and the whole app carries VIDYA (Pillar 02). The Flutter tools are
  **typed forms only.** Voice-to-text exists as a backend (`/api/ai/voice-to-text`, Sarvam →
  Gemini fallback, `expectedLanguage` hint) but the Flutter app never calls it.
- **Data model:** saved artifacts → `users/{uid}/library/{id}` (surfaced as My Library). Tool
  outputs are the DocumentSheet payloads.

### Pillar 02 — AI co-teacher (VIDYA)  ·  `Sparkles`  ·  persistent coach on every page

**This is the soul feature and it is 100% absent from Flutter.** On web it is the floating
**OmniOrb** (`src/components/omni-orb.tsx`) — a mic orb pinned bottom-right on every screen.

**Interaction model (web):**
1. Teacher taps the orb → speaks (or types). `MicrophoneInput` records → POSTs audio to
   `/api/ai/voice-to-text` with `expectedLanguage` = UI language → gets `{text, language}`.
2. Client POSTs to **`/api/assistant`** with `{message, chatHistory, currentScreenContext:{path},
   teacherProfile, detectedLanguage, uiLanguage}`.
3. Response: `{response: string, action: VidyaAction | null, plannedActions: VidyaAction[]}`.
   - `response` is spoken back via `/api/tts` and shown as a chat turn.
   - `action.type = 'NAVIGATE_AND_FILL'`, `action.flow ∈ {lesson-plan, quiz-generator,
     visual-aid-designer, worksheet-wizard, virtual-field-trip, teacher-training,
     rubric-generator, exam-paper, video-storyteller, instant-answer}`, `action.params` =
     pre-extracted tool inputs (gradeLevel/subject/language/topic…).
   - Single action → client `router.push`es the flow route and pre-fills the form.
   - `plannedActions` (compound intent, up to 3) → render one **confirm chip per action**;
     teacher taps each to dispatch. `action` stays = `plannedActions[0]` for back-compat.
   - `KNOWN_FLOWS` guard: drop any flow the client has no route for (prevents 404 navigation).
4. **Session persistence:** `GET/POST /api/vidya/session` — `users/{uid}/vidya_sessions/{id}`
   `{messages[], actionsTriggered[], screenPaths[]}`, capped 50 msgs, 10 sessions retained.
5. **Profile:** `/api/vidya/profile` — teacher context the supervisor personalizes on.
6. Caching (server side, transparent to client): L1 in-proc + L2 Firestore `vidya_intent_cache`,
   fresh single-turn conversational replies only.

**Data model:** `users/{uid}/vidya_sessions/{sessionId}` (see `api/vidya/session/route.ts`).
**Wire types:** `src/lib/sidecar/types.generated.ts` — `VidyaAction`, `VidyaActionParams`.

### Pillar 03 — Parent hotline  ·  `PhoneCall`  ·  AI voice calls to parents

Two distinct surfaces share the pillar:

**(a) In-app parent calls (authenticated, real).** Lives under **Attendance** on web
(`/attendance`, `/attendance/[classId]`, `/attendance/[classId]/marks`).
- Start a call: **`POST /api/attendance/outreach`** → body `{classId, studentId, reason:
  OutreachReason}` (plan-gated: 403 `PREMIUM_REQUIRED`). Server looks up the **stored** parent
  phone (never a caller-supplied number — F9-001 fix), creates `parent_outreach/{outreachId}`,
  returns `{outreachId}`.
- Place the call: **`POST /api/attendance/call`** `{outreachId}` → routes to the standalone
  `sahayakai-voice-call` voicebot (Twilio in prod per memory; Exotel parked) → `{callSid}`.
- Supporting routes: `/api/attendance/call-context`, `/call-summary`, `/transcript-sync`,
  `/twiml`, `/twiml-status`, `/outreach-latest`.
- **Data model:** `parent_outreach/{outreachId}` (`src/types/attendance.ts` `ParentOutreach`):
  `{teacherUid, studentName, className, reason, status: CallStatus, phone (server-filled),
  transcript: TranscriptTurn[], summary: CallSummary, performanceContext?}`. Also `ClassRecord`,
  `Student`, `DailyAttendanceRecord`, `OutreachReason`, `CallStatus`.
- **Parent Message (text draft, already in Flutter):** `POST /api/ai/parent-message`
  `{studentName, className, subject, reason, parentLanguage, performanceContext?}` →
  `{message, languageCode, wordCount}`. This is the *written* sibling of the voice call.

**(b) "Hear the Call" public lead magnet.** Web page `/try-call` (`try-call-form.tsx`).
- **`POST /api/demo-call`** (public, allowlisted) body `{phone, language, consent:true,
  turnstileToken, utm?}` → gated (feature flag `DEMO_CALL_ENABLED`, consent, +91 mobile,
  Turnstile, daily-cap/IP/cooldown) → places one Twilio call with a fixed server-side script →
  `{id}` (202). Status: `GET /api/demo-call/status`, `/api/demo-call/[id]`, TwiML at
  `/api/demo-call/twiml`. Data: `demo_leads/{id}`.
- Marketing-flavored; for the app this is a lower-priority "try it on yourself" demo, but it is
  the cheapest way to *show* the voice-call magic without a class roster set up.

### Pillar 04 — Staffroom  ·  `Users`  ·  structured professional teacher network

Web page **`/community`** (`src/app/community/page.tsx`) + `/community-library`,
`/profile/[uid]`, `/my-profile`. All **server actions**, not REST routes.

**Sub-features & actions (`src/app/actions/{groups,community,connections}.ts`):**
- **Groups / feed:** `ensureUserGroupsAction`, `getMyGroupsAction`, `getGroupAction`,
  `joinGroupAction`, `leaveGroupAction`, `discoverGroupsAction`, `getGroupPostsAction`,
  `createGroupPostAction`, `likeGroupPostAction`, `sendGroupChatMessageAction`,
  `getUnifiedFeedAction`.
- **Posts / resources:** `createPostAction`, `toggleLikeAction`, `getPosts`, `getFollowingPosts`,
  `getLibraryResources`, `likeResourceAction`, `saveResourceToLibraryAction`,
  `publishContentToLibraryAction`, `shareLatestContentAction`, `trackDownloadAction`.
- **People / connections:** `getRecommendedTeachersAction`, `getAllTeachersAction`,
  `followTeacherAction`, `getFollowingIdsAction`, `sendConnectionRequestAction`,
  `acceptConnectionRequestAction`, `declineConnectionRequestAction`, `disconnectAction`,
  `getMyConnectionDataAction`.
- **Community chat:** `sendChatMessageAction`, live persona pulse (`/api/community/persona-pulse`).
- **Components to mirror:** GroupList, GroupsSidebar, UnifiedFeed, FeedPost, ShareComposer,
  TeacherDirectory, ResourceFeed, ExploreGroups, CommunityChat, CreatePostDialog,
  ContextualConnect.
- **Data model / types:** `src/types/community.ts` — `Group`, `FeedItem`, `TeacherSuggestion`;
  `src/types` — `MyConnectionData`. Firestore: `groups/*`, `posts/*`, `community_chat/*`,
  connection docs, `library_resources/*`.
- **Flutter note:** server actions have no public REST surface. Flutter must either call Firestore
  directly (client SDK) for reads/writes it can express under security rules, or the backend must
  expose thin `/api/community/*` REST wrappers. **Flag as an integration decision** (see §5).

### Pillar 05 — Pro inbox  ·  `Inbox`  ·  structured professional messaging

Web page **`/messages`** (`src/app/messages/page.tsx`). Server actions
(`src/app/actions/messages.ts`) + live Firestore subscriptions.

**Sub-features & actions:**
- `getOrCreateDirectConversationAction`, `createGroupConversationAction`, `sendMessageAction`
  (text / voice note / library-attachment), `markConversationReadAction`,
  `getTotalUnreadCountAction`, `acknowledgeDeliveryAction`.
- Live unread: Firestore `onSnapshot` on `conversations where participantIds array-contains uid`,
  `unreadCount[uid]`. Presence, typing, delivery status, audio waveform for voice notes.
- **Components:** ConversationList, ConversationThread, MessageBubble, NewConversationPicker,
  VoiceRecorder, DeliveryStatus, TypingIndicator, PresenceDot, AudioWaveform, LibraryPickerDialog.
- **Data model:** `src/types/messages.ts` — `Conversation`, message docs. Firestore
  `conversations/{id}` + `conversations/{id}/messages/*`. Entry point is gated on a connection
  (you can only DM teachers you're connected with — ties Pillar 05 to Pillar 04).
- **Cross-cut:** unread count powers the sidebar badge; **connection requests arrive as
  Notifications, not Messages** (`/notifications`).

### Pillar 06 — Operating system  ·  `LayoutGrid`  ·  the platform substrate

Not a single screen — the *promise* that makes 01–05 usable on the ground. It shows up as:
- **11 languages** — `LANGUAGE_TO_ISO`, `useLanguage()`; Flutter already has the 11-locale ARB
  system + Indic font fallback (PREMIUM_DESIGN_SPEC §3.2).
- **28 state boards + NCERT** — board is a param on prep-desk tools (`board` in lesson-plan /
  exam-paper). Surface as a first-class **profile setting** + tool default.
- **Cheapest Android / offline / PWA** — Flutter app *is* the "installable" answer; offline path
  is scaffolded but **not GA** (memory: `project_offline_status`). Do not claim offline GA.
- **Plan / usage / entitlements** — `withPlanCheck`, `/api/usage`, PlanBadge, UsageDisplay.
- **Settings / profile / privacy** — `/settings`, `/my-profile`, `/privacy-for-teachers`.
- **Expressed in IA** as: the **Me/Account** hub (profile · board & language defaults · plan &
  usage · settings · privacy), not as a nav tab of its own.

---

## 2. GAP ANALYSIS — web pillars vs current Flutter app

Current Flutter (`lib/features/**`): `splash, onboarding, dashboard, lesson_planner,
quiz_generator, instant_answer, worksheet_wizard, rubric_generator, exam_paper,
teacher_training, parent_message, assess_assignment, library, profile, settings`.
Nav today: **Home / Create / Library / Me** (`app_shell.dart` + `mobile-bottom-nav` parity).
Router (`app_router.dart`): the 8 tools + splash/login/onboarding/settings/library-detail.

| Pillar | State in Flutter | What's MISSING |
|---|---|---|
| 01 Prep desk | Partial | **Voice-first entry on every tool** (mic → `/api/ai/voice-to-text`); prefill-from-voice. Tools not built: **Visual Aid, Content Creator, Video Storyteller, Virtual Field Trip, Assessment Scanner**. |
| 02 AI co-teacher (VIDYA) | **Absent** | The entire VIDYA surface: mic orb / conversation, `/api/assistant` client, `/api/vidya/session` persistence, NAVIGATE_AND_FILL deep-link + prefill, plannedActions confirm-chips, TTS playback. **This is the #1 gap.** |
| 03 Parent hotline | Text-only | The **voice call** surface: Attendance/roster (`ClassRecord`/`Student`), `/api/attendance/outreach` + `/call`, call status + transcript + summary UI. Optionally `/api/demo-call` "Hear the Call". `parent_message` (text) already exists — reposition it *inside* this pillar. |
| 04 Staffroom | **Absent** | Community: groups, unified feed, posts, resource library, teacher directory, connections, community chat. Needs a REST or Firestore-direct integration decision. |
| 05 Pro inbox | **Absent** | Messaging: conversation list + thread, send text/voice/library attachments, unread badges, presence/typing/delivery, connection-gated entry. |
| 06 Operating system | Partial | i18n ✅; **board/NCERT defaults** not surfaced; plan/usage/entitlement UI; privacy screen; the "OS" framing in nav/Me. |
| Cross-cutting | — | **Notifications** (`/notifications`, connection requests + unread badge) — absent. Powers badges for 04/05. |

**Missing, ranked for the loop (highest leverage first):**
1. **VIDYA voice (Pillar 02) + the voice-first home** — the soul; unlocks the founder's north star.
2. **Voice-to-text on prep-desk tools (Pillar 01)** — makes "just speak" real per-tool.
3. **Parent hotline voice call (Pillar 03)** — the demoable "wow", real backend already live.
4. **Staffroom (04) + Pro inbox (05) + Notifications** — the network; larger surface, needs REST/Firestore decision.
5. **Remaining prep-desk tools (Visual Aid, Video Storyteller, Field Trip, Content Creator, Assessment Scanner)** — copy the U8/DocumentSheet pattern.
6. **OS framing (06)** — board defaults, plan/usage, privacy in the Me hub.

---

## 3. PROPOSED NAVIGATION / IA (premium, pillar-oriented)

**Verdict: yes — re-shape nav to express the pillars, but do NOT make it a flat 6-tab bar.**
Six bottom tabs is a cheap-utility tell (PREMIUM_DESIGN_SPEC §7.9) and breaks the ≥48dp rhythm on
a 360dp phone. Instead: **a voice-first Home that IS Pillar 02, four bottom-nav destinations that
group the pillars, and pillar surfaces reached from Home.**

### 3.1 The home screen — the founder's near-empty voice-first VIDYA canvas

`Routes.home` becomes **"The Almanac, opened to a blank page"**: seamless app bar (Seal mini +
wordmark), a quiet serif time-aware greeting + almanac date line, then the screen is **mostly
empty above one LARGE central mic** — the VIDYA conversation launcher (Pillar 02).
- **Mic:** ~96–120dp haloed IconWell (`primary@0.06 / @0.12`, Lucide `mic`/`sparkles`), the
  single saffron focal element (keeps saffron < 10%). One authored breathing motion (3000ms
  opacity, reduce-motion → static). Tap → full-screen VIDYA conversation sheet (`e4`).
- **Under the mic:** a hairline-ruled row of **rotating prompt suggestions** using the
  `pillar.*.rotating` strings ("*Give your teachers …*") — dignified, not marketing.
- **Below the fold (scroll):** `EditorialSectionHeader "YOUR TEACHING TOOLS"` → the
  `kToolRegistry` tool register (feature tile + refined rows, ink-settle stagger) so Prep desk
  is one scroll away and the home isn't a dead end. Optional real-data summary strip
  ("3 lessons this week · 12 saved"), hidden at zero.
- This directly answers *"the home should be a nearly-empty voice-first screen with one large
  mic."* Home = Pillar 02 as the canvas; Pillar 01 as the register beneath it.

### 3.2 Bottom nav — four destinations (floating bar, PREMIUM_DESIGN_SPEC §5)

Keep the floating bar (radius 20, `surface`, `e3`, active saffron pill). Re-label to pillar
language while keeping 4 targets:

| Tab | Lucide | Route | Pillars it fronts |
|---|---|---|---|
| **Home** | `mic` (or `home`) | `/` | 02 VIDYA canvas + 01 tool register |
| **Network** | `users` | `/staffroom` | 04 Staffroom + 05 Pro inbox (segmented: *Staffroom / Inbox*) + Notifications |
| **Library** | `library` | `/my-library` | saved artifacts (01 outputs) |
| **Me** | `user` | `/me` | 06 Operating system hub: profile · board & language · plan & usage · settings · privacy |

- **Parent hotline (03)** is *not* a bottom tab — it's reached from Home (a "Call a parent"
  entry in the tool register / VIDYA) and from a class roster screen. Voice calls are a deliberate
  action, not a browse destination (mirrors web, where it lives under Attendance).
- **Create** (the old palette action) is **absorbed into the Home mic** — speaking *is* create.
  Keep a `⌘K`-style command palette reachable (long-press mic / a small "type instead" affordance)
  but it's no longer its own tab. This is the single biggest IA improvement: the current "Create =
  open a palette" tab is the form-first artifact the founder is reacting against.
- **Network** merges Staffroom + Pro inbox under one destination with an **AppSegmented** header
  (*Staffroom · Inbox*), because Pillar 05 is connection-gated by Pillar 04 — they're one mental
  model ("my professional network"). Notifications is the bell in that screen's app bar with the
  unread badge.

### 3.3 Route additions (`lib/core/router/routes.dart`)

```
// Pillar 02
Routes.vidya            = '/vidya'            // full-screen conversation (or a modal over Home)
// Pillar 03
Routes.parentHotline    = '/parent-hotline'   // roster + call launcher
Routes.classRoster      = '/parent-hotline/class/:classId'
Routes.callDetail       = '/parent-hotline/call/:outreachId'  // status/transcript/summary
Routes.hearTheCall      = '/hear-the-call'    // optional demo-call self-test
// Pillar 04
Routes.staffroom        = '/staffroom'        // feed + groups + directory
Routes.groupDetail      = '/staffroom/group/:groupId'
Routes.teacherProfile   = '/staffroom/teacher/:uid'
// Pillar 05
Routes.inbox            = '/inbox'
Routes.conversation     = '/inbox/:conversationId'
// Cross-cut
Routes.notifications    = '/notifications'
// Pillar 01 (new tools)
Routes.visualAid, Routes.videoStoryteller, Routes.virtualFieldTrip,
Routes.contentCreator, Routes.assessmentScanner
```

Every new route registers in `app_router.dart` and, where it's a tool, gets a `kToolRegistry`
entry so it appears on Home + palette automatically (the registry is the single source of truth —
`tool_registry.dart`).

---

## 4. PREMIUM FLUTTER IMPLEMENTATION PLAN (reuse the Ledger system)

Order = the founder's priority (voice first), each unit reuses PREMIUM_DESIGN_SPEC widgets; per-unit
acceptance inherits the design spec's gate (`flutter analyze` 0, `token_guard` PASS, behavior tests
green, goldens re-baselined at 360/800 light+dark with Indic probes).

### P1 — VIDYA (Pillar 02) + voice-first Home  *(the soul)*
- **New feature `lib/features/vidya/`** (data/domain/presentation). Data: `VidyaRepository` →
  `POST /api/assistant`, `GET/POST /api/vidya/session`, `/api/vidya/profile`; auth via Firebase
  `Bearer` token (mirror `omni-orb.tsx` `vidyaApiFetch`). Port `VidyaAction`/`VidyaActionParams`
  from `types.generated.ts`; keep the `KNOWN_FLOWS` guard mapping `flow → Routes.*`.
- **Voice pipeline `lib/shared/media/`**: mic capture → `POST /api/ai/voice-to-text` (multipart
  `audio` + `expectedLanguage` = current locale ISO) → `{text, language}`; TTS playback via
  `/api/tts` for `response`. Respect Sarvam MIME note (send wav/mp3 where possible).
- **UI:** the §3.1 Home mic (haloed IconWell, breathing) + a **VIDYA conversation sheet** —
  chat turns as `AppCard(inset)` bubbles, `DocumentSheet` when a turn returns a structured
  artifact, **plannedActions → confirm chips** (Chip selected grammar), single action →
  `context.go(flow, extra: params)` and prefill. Ink-settle reveal on each turn.
- **Deep-link + prefill:** the destination tool screens accept `VidyaActionParams` as route
  `extra` and pre-populate their form controllers (the controllers already exist per feature).
- Reuse: IconWell v2, AppCard(inset), Chip, DocumentSheet, AppMotion (`inkSettle`), the greeting
  header from `dashboard_screen.dart`.

### P2 — Voice-first on prep-desk tools (Pillar 01)
- Add a mic affordance to each tool's `LabeledField`/form header (reuse the P1 voice pipeline).
  Speaking dictates a field or the whole intent; on `/api/ai/voice-to-text` return, prefill.
- Build the 5 missing tools (Visual Aid, Video Storyteller, Virtual Field Trip, Content Creator,
  Assessment Scanner) by **copying the U8 lesson-plan reference**: filled form → `DocumentSheet`
  result (Visual Aid → image card; Assessment Scanner → multipart upload + ScoreRing). Add each to
  `kToolRegistry` + a `Routes` const + `app_router` entry.

### P3 — Parent hotline (Pillar 03)
- **New feature `lib/features/parent_hotline/`**. Roster screen (list `ClassRecord`/`Student` via
  attendance actions/REST) → **"Call parent"** → `POST /api/attendance/outreach {classId,
  studentId, reason}` → `{outreachId}` → `POST /api/attendance/call {outreachId}` → poll status.
  Call-detail screen renders `CallStatus`, `TranscriptTurn[]`, `CallSummary` as a `DocumentSheet`
  (transcript = ruled register; summary masthead). Handle 403 `PREMIUM_REQUIRED` with the plan gate.
- Move existing `parent_message` (text draft) **into** this pillar's surface as the "send a written
  note" sibling; keep its `/api/ai/parent-message` wiring.
- Optional **Hear-the-Call**: a public `/api/demo-call` self-test screen (consent + phone + Turnstile
  + language) as an onboarding "wow" — low priority, needs `DEMO_CALL_ENABLED`.

### P4 — Staffroom + Pro inbox + Notifications (Pillars 04/05)
- **Integration decision required (flag to eng lens):** community/messages are **server actions**,
  not REST. Two options: (a) call Firestore directly from Flutter under existing security rules for
  reads + simple writes (fastest, but re-implements action business logic client-side); (b) add thin
  `/api/community/*`, `/api/messages/*`, `/api/notifications/*` REST wrappers over the actions
  (cleaner, backend work). Recommend **(b)** for parity + to keep the LLM-trust/security boundary
  server-side; use **(a)** only for pure live subscriptions (unread counts, presence, feed snapshots).
- **Network destination:** AppSegmented *Staffroom · Inbox*.
  - Staffroom: UnifiedFeed (`AppCard` posts, ink-settle stagger), GroupList/GroupsSidebar,
    TeacherDirectory (connect chips), ShareComposer, CommunityChat.
  - Inbox: ConversationList + ConversationThread (bubbles = `AppCard` grammar), VoiceRecorder
    (reuse P1 mic + AudioWaveform), delivery/typing/presence, connection-gated empty state.
  - Notifications: bell in the app bar + `/notifications` list; unread badges on the floating nav
    (live Firestore `onSnapshot`, mirror `app-sidebar.tsx`).
- Types to port: `types/community.ts` (`Group`, `FeedItem`, `TeacherSuggestion`),
  `types/messages.ts` (`Conversation`), `MyConnectionData`.

### P5 — Operating-system hub (Pillar 06) + Me
- Rebuild **Me** as the OS hub: profile · **board & language defaults** (feed board into tool
  params) · plan & usage (`/api/usage`, PlanBadge/UsageDisplay parity) · settings · privacy.
- Do **not** claim offline GA (memory `project_offline_status`).

### Cross-cutting rules
- Reuse `kToolRegistry` as the single tool source; new pillars that are "browse destinations" get
  their own screens, not registry rows.
- All authed calls: Firebase ID token → `Authorization: Bearer`; expect `x-user-id` server-side;
  handle 401 / 403 `PREMIUM_REQUIRED` uniformly (existing auth-guard pattern).
- Every new surface passes the PREMIUM_DESIGN_SPEC §7 "Definition of Premium Done" grade and the
  Indic/48dp/AA/Lucide-only guarantees.

---

## 5. OPEN DECISIONS (for eng-lens / build loop)
1. **Community/Messages transport:** REST wrappers (recommended) vs Firestore-direct. Blocks P4.
2. **VIDYA home vs modal:** mic on Home opening a full-screen sheet (recommended) vs a dedicated
   `/vidya` route as a bottom-nav peer. Spec assumes the former (keeps 4 tabs).
3. **Voice provider parity:** confirm Flutter records a Sarvam-friendly MIME (wav/mp3) to avoid the
   Gemini-only fallback path noted in `voice-to-text/route.ts`.
4. **Parent hotline entitlement:** it's plan-gated (403 `PREMIUM_REQUIRED`) — confirm the app's
   stubbed auth exposes a plan so the gate UI is reachable.
5. **Demo-call in app:** include "Hear the Call" (needs public endpoint + Turnstile) or omit for v1.

---

**File:** `docs/flutter/pillars/SPEC_pillars_ia.md`
