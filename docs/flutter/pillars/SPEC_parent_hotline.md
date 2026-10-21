# SPEC — Pillar 03 · Parent Hotline (AI voice calls to parents)

**Status:** DRAFT for the autonomous build loop · **Lens:** Parent Hotline (pillar 03)
**Design system:** reuse `docs/flutter/design/PREMIUM_DESIGN_SPEC.md` — "The Ledger · Ivory &
Ink, Saffron & Pine." Nothing new visually; this pillar composes the existing shared widgets
(`AppCard`, `DocumentSheet`, `EditorialSectionHeader`, `IconWell`, `AppSegmented`,
`LabeledField`, `PrimaryButton`, `SecondaryButton`, `ScoreRing` is NOT used here, `AppSkeleton`,
`EmptyView`, `AiText`, `PressableScale`) exactly as the tool features do.

**One-line product truth:** a teacher picks a student, a reason, and confirms the parent's
language; SahayakAI **places a real phone call** to the parent in that language; a warm AI agent
holds a short 2-way conversation; when the call ends the teacher reads an **Ink-settled
DocumentSheet** — sentiment, what the parent said, what they committed to, and the teacher's
action items — plus the full transcript. The app **triggers and observes**; the actual
telephony + STT/LLM/TTS all live server-side.

---

## PART A — THE FEATURE AS BUILT ON THE WEB / BACKEND

### A.0 Where it lives in the product

This is the "Parent hotline" pillar. On the web it is **not** a standalone page — it is the
**Contact-Parent modal** launched from a student row on the Attendance class page
(`src/app/attendance/[classId]/page.tsx` → `src/components/attendance/student-manager.tsx` →
`src/components/attendance/contact-parent-modal.tsx`). The Flutter app will promote it to a
first-class **Parent Hotline screen** (a proper destination), because on mobile "one ring for
parents" is a headline capability, not a modal buried in attendance.

Gating: outreach creation requires an **advanced/premium plan**
(`hasAdvancedPlan(profile.planType)` — `/api/attendance/outreach` returns `403 PREMIUM_REQUIRED`
otherwise). Auto-call additionally requires Twilio to be configured server-side AND the parent's
language to be in `TWILIO_LANGUAGE_MAP`.

### A.1 Data model — `parent_outreach/{outreachId}` (Firestore)

The whole feature revolves around one document. Canonical TS type:
`src/types/attendance.ts` → `ParentOutreach`. Fields the client cares about:

| Field | Type | Notes |
|---|---|---|
| `id` | string | Firestore doc id = **`outreachId`**, the join key for every call route |
| `teacherUid` | string | server-trusted owner; every read/write checks it |
| `classId`, `className` | string | |
| `studentId`, `studentName` | string | |
| `parentPhone` | E.164 string | **server-trusted**, sourced from `students/{id}.parentPhone` — NEVER from the client (F9-001) |
| `parentLanguage` | `Language` (full name e.g. `"Kannada"`) | drives TTS voice + STT + agent language |
| `reason` | `OutreachReason` | `consecutive_absences \| poor_performance \| behavioral_concern \| positive_feedback` |
| `teacherNote?` | string | free-text the teacher adds |
| `generatedMessage` | string | the AI-drafted opening message, in the parent's language |
| `deliveryMethod` | `'twilio_call' \| 'whatsapp_copy'` | call vs. copy-to-WhatsApp fallback |
| `subject?`, `teacherName?`, `schoolName?` | string | greeting personalization (server-trusted from profile) |
| `callSid?` | string | provider call id, set once the call is placed |
| `callStatus?` | `CallStatus` | `initiated \| completed \| failed \| no_answer \| busy \| manual` |
| `transcript?` | `TranscriptTurn[]` | `{ role: 'agent'\|'parent', text, timestamp }` |
| `callSummary?` | `CallSummary` | the structured AI summary (below) |
| `answeredBy?` | string | Twilio machine-detection result (`human`, `machine_end_beep`, …) |
| `callDurationSeconds?` | number | |
| `turnCount?` | number | server-derived from transcript length |
| `performanceContext?` | `PerformanceContext` | recent marks snapshot so the agent can quote scores |
| `voicePipelineMode?` | `'streaming' \| 'batch'` | which pipeline ran |
| `createdAt`, `updatedAt` | ISO string | |

`CallSummary` (the DocumentSheet payload):
```
parentResponse: string                // 1–2 sentence recap, in the TEACHER's language
parentConcerns: string[]
parentCommitments: string[]
actionItemsForTeacher: string[]       // always ≥1
guidanceGiven: string[]
parentSentiment: 'cooperative'|'concerned'|'grateful'|'upset'|'indifferent'|'confused'
callQuality: 'productive'|'brief'|'difficult'|'unanswered'
followUpNeeded: boolean
followUpSuggestion?: string
generatedAt: string
```

### A.2 The full trigger → call → summary flow

1. **Draft the message** — `POST /api/ai/parent-message` (already wired in Flutter as the
   `parent_message` feature). Input: `{ studentName, className, subject, reason, teacherNote?,
   parentLanguage, consecutiveAbsentDays?, performanceContext?, userId }`. Output:
   `{ message, languageCode }`. This is the opening the parent hears / the WhatsApp copy.
2. **Persist the outreach** — `POST /api/attendance/outreach`
   (`src/app/api/attendance/outreach/route.ts`). Auth: `Authorization: Bearer <idToken>` →
   middleware maps to `x-user-id`. Body:
   ```jsonc
   {
     "classId": "...", "className": "...",
     "studentId": "...", "studentName": "...",
     "parentPhone": "...",        // IGNORED server-side (F9-001) — sent for shape only
     "parentLanguage": "Kannada",
     "reason": "consecutive_absences",
     "teacherNote": "optional",
     "generatedMessage": "…(from step 1)…",
     "deliveryMethod": "twilio_call",   // or "whatsapp_copy"
     "performanceContext": { … } | undefined,
     "subject": "Mathematics"
   }
   ```
   Server verifies class ownership, reads the **stored** parent phone, enforces a
   **5-minute per-(teacher,student) dedup window** (returns `429 { retryAfterSeconds }` +
   `Retry-After` header), and writes the doc. Returns `{ outreachId }`.
   Errors: `403 PREMIUM_REQUIRED`, `404 Class/Student not found`, `422 Student has no parent
   phone on record`, `429 dedup`.
3. **Place the call** — `POST /api/attendance/call` (`src/app/api/attendance/call/route.ts`).
   Auth: `x-user-id`. Body: `{ outreachId, parentLanguage }`. Server re-verifies ownership,
   re-reads the trusted phone, validates E.164, checks the language is callable
   (`TWILIO_LANGUAGE_MAP[lang]` — `422` "Auto-call not supported for X. Use WhatsApp copy
   instead." for languages with no Twilio voice), then dials via the provider. Returns
   `{ callSid }`. Sets `callStatus: 'initiated'`, `deliveryMethod: 'twilio_call'`.
   Errors: `401`, `403`, `404`, `422`, `502 Failed to initiate call`, `503 Twilio not
   configured`.
4. **The conversation happens on the phone** (fully server-side, see A.3). Firestore
   `parent_outreach/{outreachId}` is updated live with `transcript`, `turnCount`, then terminal
   `callStatus`, then `callSummary`.
5. **The app polls for the result** — `GET /api/attendance/call-summary?outreachId=…`
   (`src/app/api/attendance/call-summary/route.ts`). Auth: `x-user-id` (ownership-checked).
   Returns `{ callStatus, callDurationSeconds, answeredBy, turnCount, transcript, callSummary }`.
   Poll cadence used by the web modal: first poll at 3s, then every 5s, ~5 min ceiling while
   `initiated`; once terminal but no summary yet, poll every 3s for ~24s then give up gracefully.
6. **Resume / re-open** — `GET /api/attendance/outreach-latest?studentId=…`
   (`src/app/api/attendance/outreach-latest/route.ts`). Auth: `x-user-id`. Returns the most
   recent outreach for that (teacher, student) within 24h: `{ outreachId, callStatus, …,
   transcript, callSummary } | { outreachId: null }`. Lets the teacher close the screen mid-call
   and still see the summary later, or jump straight to a completed summary on re-open.

**WhatsApp fallback:** for languages Twilio can't voice (or when the teacher prefers), the flow
stops at step 2 with `deliveryMethod: 'whatsapp_copy'`, copies `generatedMessage` to the
clipboard, and the outreach is logged with `callStatus: 'manual'`. No call is placed.

### A.3 The telephony backend (NOT client — for context only)

**Provider = Twilio, in BOTH regions, flipped 2026-07-05.** A `VOICE_PROVIDER` env switch
(`twilio` default | `exotel`) also exists; `exotel` forwards to the standalone
`sahayakai-voice-call` service. There are **two pipeline modes** behind Twilio:

- **Batch mode (default)** — `src/app/api/attendance/twiml/route.ts`. Twilio fetches TwiML;
  the route plays `<Say>` greeting + teacher message + invite, then `<Gather input="speech
  dtmf">` captures the parent's speech. Each turn POSTs back; the route calls the AI agent
  (`dispatchParentCallReply` → Python sidecar, falling back to Genkit
  `generateAgentReply`), appends turns atomically to a `turns` subcollection + the `transcript`
  array, and returns the next `<Say>`+`<Gather>`. Max 6 turns. Per-language TTS voices +
  prompts live in `TWILIO_VOICE_MAP` / `CALL_MENU_PROMPTS` (`src/types/attendance.ts`). Parent
  can press `2`/`*` to end.
- **Streaming mode** — `<Connect><Stream>` to the FastAPI **voice-server**
  (`services/voice-server/`, Pipecat + Sarvam STT/TTS + Gemini over Twilio Media Streams
  WebSocket `/ws/call`). It fetches context via `GET /api/attendance/call-context` (internal
  `X-Internal-Key` auth) and pushes transcript back via `POST /api/attendance/transcript-sync`.
  Selected when the orchestrator is healthy (`getEffectiveMode()`).

**Internal service-to-service routes the client must NEVER call:**
`GET /api/attendance/call-context` and `POST /api/attendance/transcript-sync` (both gated by
`X-Internal-Key`, used by the voice pipeline), and `POST /api/attendance/twiml*` (Twilio
signature-gated webhooks). The AI agent + summary generation (`src/ai/flows/parent-call-agent.ts`)
also run server-side only.

**The AI agent's character** (informs our UI copy so it doesn't over-promise): a warm school
representative, ≤3–4 short sentences per turn, entirely in the parent's script, never brands
itself, validates emotion + offers ONE practical home-learning tip, wraps up by turn 6. Village
parents get the same dignity as city parents. The call opens with a recorded automated/AI notice
(DPDP consent prologue gated behind a flag, currently en-IN only).

### A.4 Demo call (public lead magnet — reference, not the teacher flow)

`src/app/api/demo-call/**` ("Hear the Call"): a public visitor asks us to call **their own**
number once with a fixed server-side script. Flag-gated (`DEMO_CALL_ENABLED`), Turnstile +
daily-cap/IP/phone-repeat gated, phone encrypted at rest. Poll `GET /api/demo-call/[id]` for
status. **Relevant to Flutter only** as an optional marketing surface (`U12` "Demo Call" in the
design plan) — it lets a prospective teacher hear the hotline before subscribing. The
authenticated teacher hotline is the `attendance/*` flow above; keep them separate.

### A.5 What the app surfaces vs. what it cannot

| Concern | Owner | App role |
|---|---|---|
| Placing the phone call, ringing, machine detection | Twilio (server) | fire `POST /call`, show status |
| STT / LLM / TTS, per-turn conversation | voice-server / sidecar / Genkit (server) | none — observe transcript |
| Live audio of the call | Twilio ↔ parent's phone | **none** — the teacher is NOT on the line; there is no in-app audio stream to join |
| Transcript, summary, sentiment, action items | Firestore + AI flow (server) | **poll + render** |
| Parent phone number | server-trusted from student record | **never send/choose it** |
| Language → voice mapping, callability | server (`TWILIO_LANGUAGE_MAP`) | mirror the callable set to disable Call for unsupported langs |

There is **no realtime/websocket for the client**. The teacher-facing surface is a **polling**
model against `call-summary` (and `outreach-latest` on open). Do not attempt to join the media
stream — the app watches the outcome, it is not a softphone.

---

## PART B — THE PREMIUM FLUTTER TREATMENT

### B.0 Placement & navigation

- New feature module `lib/features/parent_hotline/` mirroring the standard layout
  (`data/ domain/ presentation/`), same as `parent_message`.
- Entry points: (1) a **tool tile** on the Dashboard Almanac register ("Parent Hotline",
  IconWell glyph `phone-call`), and (2) a per-student **"Call parent"** action once the
  Attendance pillar (U12) lands — passing `studentId/classId/parentLanguage`. For the rebuild,
  ship the standalone screen first (Dashboard entry); the attendance hand-off is additive.
- Route it through the existing `ToolScaffold` (max reading width 640, top margins, back).
- **Reuses the already-built `parent_message` feature** for step 1 (message draft). Do not
  re-implement the draft call — depend on `parentMessageRepositoryProvider`.

### B.1 The screen as a composed flow (one screen, staged content)

Model it as a staged flow inside one `ToolScaffold`, the same mental model as the web modal but
re-authored to the Ledger register. Stages (a `sealed`/enum `HotlineStage`):
`pickStudent → reason → compose → review → calling → summary`. Each stage transition uses the
sanctioned `AppMotion.small` reveal (fade + `slideY 12→0`); no stage is a separate route
(keeps the flow in one controller, matches web).

**Stage 1 — `pickStudent`** (skipped when launched from a student row).
`EditorialSectionHeader(eyebrow: "PARENT HOTLINE")` + a `LabeledField`-driven class picker
(`AppSegmented` when ≤3 classes, else a chip `Wrap`) then a student list of `AppCard(flat)` rows
(IconWell `user`, `titleMedium` name, `bodyMedium` muted `Class · parent language`). Rows are
`PressableScale`. If a student has **no parent phone on record**, render the row disabled with a
`NoteBanner`-style inline hint ("No parent number saved") — this mirrors the server `422` so the
teacher never hits a dead call.

**Stage 2 — `reason`.** Reuse the 4 reasons verbatim (`consecutive_absences`,
`poor_performance`, `behavioral_concern`, `positive_feedback`). Render as **selectable
`AppCard`s** (not radio): IconWell per reason (`calendar-x-2`, `trending-down`,
`triangle-alert`, `star`), `titleMedium` label + `bodyMedium` description; selected state uses
the `primaryContainer` fill + 1.5px primary border grammar from the Chip spec. A saffron
`eyebrow` header "WHY ARE YOU CALLING". Pre-select when a suggested reason is passed in.

**Stage 3 — `compose`.** A reason-aware **evidence panel** (port `ReasonContextPanel`) rendered
as an `AppCard(inset)` — absent-days chips for attendance, lowest recent marks for
poor-performance (fetched via `GET /api/performance/student/{id}?classId&academicYear` →
`performanceContext`), a "recent win" for positive feedback, note-prompts for behavioral. Then a
`LabeledField` (multiline) for the teacher note with a reason-specific placeholder. Primary CTA
`PrimaryButton("Draft the message")` → calls the existing parent-message repository. Show
`AppSkeleton` (mirrors the message card) while drafting.

**Stage 4 — `review`.** The drafted `generatedMessage` in a **`DocumentSheet`-lite** read block
(`AppCard(inset)`, `AiText` for correct Indic line-height + matra safety), a ghost "Regenerate"
(`SecondaryButton`/ghost). Then the **decision bar** (sticky footer, `e3`):
  - `SecondaryButton("Copy for WhatsApp")` — always available (the universal fallback).
  - `PrimaryButton("Call parent")` — **enabled only when callable**: `twilioConfigured &&
    TWILIO_LANGUAGE_MAP[parentLanguage] != null`. When the language is not callable, hide the
    Call button and show a `NoteBanner` ("Auto-call isn't available for {language} yet — copy
    for WhatsApp instead"), mirroring the server `422`.
  A tiny meta line under the sheet: parent phone (masked, last 4) · language · the "the call
  opens with an automated AI notice" reassurance (dignity + honesty; matches A.3).

**Stage 5 — `calling`.** The **signature waiting state**. Ivory ground, a centered saffron
`IconWell`-style haloed `phone-call` glyph with a single **breathing** halo (reuse EmptyView's
3000ms opacity breathe; reduce-motion → static), serif `displaySmall` "Calling {parentName}'s
parent…", `bodyMedium` muted status line driven by `callStatus`
(`initiated→"Ringing…"`, then "Conversation in progress"), and a live `dataMedium` tabular
"{turnCount} exchanges" pill once `turnCount > 1`. A quiet `bodySmall` reassurance: "You can
leave this screen — the summary will be waiting for you." (backs the `outreach-latest` resume
path). **No fake progress bar** — this is a real phone call of unknown length; a shimmer/breathe
is honest, a determinate bar is not.

**Stage 6 — `summary`.** The **premium payoff — a full `DocumentSheet`** rendered with the
**Ink-settle** reveal (each block `fadeIn + moveY 8→0`, 40–55ms stagger — the document assembles
itself). This is the money shot for pillar 03. Structure:
  - **Masthead:** saffron eyebrow `"PARENT CALL · {REASON}"`, title `displaySmall`
    "{studentName}'s parent" (Fraunces), 2px saffron→transparent rule, then a **meta badge
    `Wrap`**: a sentiment badge (color-toned: `grateful/cooperative`→pine, `concerned/confused`→
    saffron-tint, `upset`→error-tint, `indifferent`→muted), duration ("{n} min"), "{turnCount}
    exchanges". Use `AppBadge`.
  - **"WHAT THE PARENT SAID"** section (saffron-tick `titleSmall` header) → `parentResponse` in
    `AiText`.
  - **"CONCERNS RAISED"** → `parentConcerns[]` as an `AppCard(inset)` list (hidden if empty).
  - **"PARENT COMMITMENTS"** → `parentCommitments[]` with a `check` glyph per item (hidden if
    empty).
  - **"YOUR ACTION ITEMS"** → `actionItemsForTeacher[]`, the one **primary-toned** block
    (saffron accent) since it's what the teacher must act on; `arrow-right` glyph per item.
  - **"GUIDANCE SHARED"** → `guidanceGiven[]` (hidden if empty).
  - **"FOLLOW-UP"** → only when `followUpNeeded`; `followUpSuggestion` in a pine-toned inset.
  - **Transcript** → a collapsed `ExpansionTile`/`details`-equivalent ("View conversation ·
    {n} messages"), each turn a row with a `bot` (agent) or `user-circle` (parent) glyph,
    `AiText` body. Agent muted, parent full ink.
  - Sticky footer action bar (`e3`): `SecondaryButton("Done")`, ghost "Call again later"
    (returns to review, respecting the 5-min dedup — surface the `429 retryAfterSeconds` as a
    disabled state + countdown copy).

  **Terminal non-summary states** (mirror the web `SummaryView`, never leave a spinner):
  - `callStatus == 'manual'` → EmptyView-style "Message copied — paste in WhatsApp to send."
  - `failed / no_answer / busy` → a warm `phone-off` state: "Line was busy" / "No answer" /
    "Call couldn't connect", `SecondaryButton("Try again")` + copy-for-WhatsApp.
  - poll exhausted, `turnCount < 2` → "Call ended before a conversation could happen."
  - poll exhausted, summary absent but transcript present → show the transcript with "Summary
    isn't available for this call."

### B.2 Data layer (Flutter)

New module `lib/features/parent_hotline/data/` following the `parent_message` pattern (Dio
`ApiClient`, Riverpod codegen repositories, DTOs with `.g.dart` json). Endpoints to bind:

| Repository method | HTTP | Route | Request / Response DTO |
|---|---|---|---|
| `createOutreach(req)` | POST | `/api/attendance/outreach` | `CreateOutreachRequestDto` → `{ outreachId }`. Map `403 PREMIUM_REQUIRED`, `422 no-phone`, `429 {retryAfterSeconds}` to typed domain errors. |
| `placeCall(outreachId, parentLanguage)` | POST | `/api/attendance/call` | `{ outreachId, parentLanguage }` → `{ callSid }`. Map `422 unsupported-language`, `502`, `503`. |
| `pollSummary(outreachId)` | GET | `/api/attendance/call-summary` | query `outreachId` → `CallResultDto { callStatus, callDurationSeconds, answeredBy, turnCount, transcript[], callSummary? }` |
| `latestForStudent(studentId)` | GET | `/api/attendance/outreach-latest` | query `studentId` → `LatestOutreachDto { outreachId?, …same fields }` |
| `draftMessage(...)` | — | — | **delegate to existing `parentMessageRepositoryProvider`** (do not duplicate) |

- Extend `ApiException` mapping so the controller can branch on `premiumRequired`,
  `noParentPhone`, `dedup(retryAfterSeconds)`, `unsupportedLanguage`. The web returns machine
  strings (`PREMIUM_REQUIRED`) and structured 429s — decode those, don't string-match blindly.
- **Auth:** the `AuthInterceptor` already injects the bearer token → middleware sets
  `x-user-id`. In foundation-v1 the token provider is stubbed (`_noToken`), so against a real
  backend these routes will `401`. Gate the whole feature behind an `authStateProvider` and show
  the standard signed-out `EmptyView` until real auth lands (do not fake the identity).
- **Domain models** in `domain/`: `ParentOutreach`, `CallResult`, `CallSummary`,
  `TranscriptTurn`, enums `OutreachReason`, `CallStatus`, `ParentSentiment`, `CallQuality`.
  Mirror `src/types/attendance.ts` exactly (name-for-name) so a future codegen stays trivial.

### B.3 Controller & polling (Flutter)

- `parent_hotline_controller.dart` (Riverpod `@riverpod` `AsyncNotifier`) owns `HotlineStage`
  + a `PollHandle`. Port the web modal's **exact** poll discipline:
  - on `calling` entry (after `placeCall`): start at 3s, then 5s interval, ceiling ~60 polls;
    on terminal status without summary, switch to 3s interval, max ~8 waits, then `pollExhausted`.
  - **Cancel on dispose / stage-leave** (the web modal tracks a timer + AbortController — do the
    same with a `Timer` + `ref.onDispose`; never `setState` after leaving the screen).
  - on screen open for a known student, call `latestForStudent` first: jump straight to
    `summary` if a terminal call already has a `callSummary`; resume `calling`+poll if
    `callStatus == 'initiated'`; else fresh flow (cases a/b/c from the web modal).
- Respect `MediaQuery.disableAnimations` for every reveal (Ink-settle → final frame).

### B.4 Reused widgets — explicit map (no new visual primitives)

| Need | Existing widget |
|---|---|
| Every surface / row / evidence panel | `AppCard` (`flat`/`elevated`/`inset`) + `PressableScale` |
| Section headers (eyebrow + hairline) | `EditorialSectionHeader` |
| Reason/status glyphs, waiting halo | `IconWell` (Lucide only) |
| Class/binary pickers | `AppSegmented` (≤3) / chip `Wrap` (else) |
| Teacher note, phone display | `LabeledField` |
| Drafted message, transcript, summary prose | `AiText` (Indic line-height + matra safety — do NOT hand-roll Text) |
| CTAs | `PrimaryButton` (Call / Draft) · `SecondaryButton` (WhatsApp / Done) · ghost (Regenerate) |
| The summary artifact | **`DocumentSheet`** (masthead + saffron ticks + Ink-settle) |
| Sentiment / meta badges | `AppBadge` |
| Loading | `AppSkeleton` (mirror the target shape) — never a bare spinner |
| Empty / terminal states | `EmptyView` |
| Inline warnings (no phone / unsupported lang) | `NoteBanner` / `InlineError` |
| Page frame | `ToolScaffold` |

**No `ScoreRing`** in this pillar (no single scalar score). **No new colors/curves/radii** —
everything resolves to the locked tokens.

### B.5 Guardrails & correctness (carry the server's hard-won lessons into the UI)

1. **Never send or choose the parent phone** for the call — pass only `outreachId` +
   `parentLanguage` to `POST /call`. The phone is server-trusted (F9-001). Display is masked.
2. **Mirror callability** — disable/hide "Call parent" for languages absent from
   `TWILIO_LANGUAGE_MAP` (`Odia` voices via Hindi fallback server-side but IS callable; the
   only truly non-callable set is whatever the map returns null for — treat the map as source of
   truth, don't hardcode). Always offer WhatsApp copy.
3. **Respect the 5-min dedup** — after a call, "Call again" should surface the `429
   retryAfterSeconds` as a countdown, not an error toast loop.
4. **Honest waiting** — breathe/shimmer, never a determinate progress bar; the call length is
   unknown and the teacher is not on the line.
5. **Resumability** — leaving `calling` must not cancel the call (it's server-side); it only
   stops polling. Re-open resumes via `outreach-latest`.
6. **Dignity + honesty in copy** — the agent is warm and never hides that it's automated; UI
   copy says "AI voice call" plainly, never "our staff will call". No aggressive marketing tone
   about teachers or parents (teacher-tone rule).
7. **i18n** — all new strings across the 11 languages; the summary text itself arrives already
   localized to the teacher's language from the server (`CallSummary` fields) — render as-is via
   `AiText`, do not re-translate.

### B.6 Build order (for the autonomous loop)

1. **P1 — data + domain.** DTOs + repository for `outreach`/`call`/`call-summary`/
   `outreach-latest`; typed error mapping; domain models mirroring `attendance.ts`. Unit-test
   decode + error branches against captured JSON fixtures.
2. **P2 — controller + polling.** `HotlineStage` machine + poll discipline + resume; widget
   tests for the state transitions (fresh / resume-initiated / resume-completed / dedup-429 /
   unsupported-language / no-phone).
3. **P3 — stages 1–4 (pick → reason → compose → review).** Compose from existing widgets; wire
   the reused `parent_message` draft; reason-aware evidence panel.
4. **P4 — stage 5 (calling).** The breathing waiting state + live status/turns.
5. **P5 — stage 6 (summary) — the hero.** `DocumentSheet` + Ink-settle + all terminal states +
   collapsible transcript. Golden tests at 360/800 light+dark with Indic probe strings.
6. **P6 (optional) — Demo Call marketing surface** (`/api/demo-call`) as a separate,
   unauthenticated "hear it first" screen if the marketing pillar wants it (U12). Keep it out of
   the authenticated hotline flow.

Universal acceptance per unit (from the design spec §6): `flutter analyze` = 0,
`scripts/token_guard.sh` = PASS, behavior tests green, goldens re-baselined with Indic probes,
saffron surface < 10%, Lucide-only, 48dp targets, WCAG AA.

---

**File:** `docs/flutter/pillars/SPEC_parent_hotline.md`
