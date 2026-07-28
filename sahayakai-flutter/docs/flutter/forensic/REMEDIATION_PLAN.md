The reviewed Flutter build isn't in this checkout, but the findings are self-consistent and the backend (`sahayakai-main`) is present and confirmed. That's enough to write the plan. Below is `REMEDIATION_PLAN.md`.

---

# SahayakAI Flutter — Remediation Plan to Voice-First End-to-End Parity

**Status:** Draft for founder review
**Last updated:** 2026-07-28
**Scope:** Prioritized, phased engineering plan to close the mobile/web parity gaps documented in this report and deliver the "speak → generate → hear/act" thesis on the Flutter app.

---

## 0. Read this before the phases

### 0.1 The one framing that changes everything: the backend is not the blocker

The forensic review kept finding the same shape of defect — a capability that **works end-to-end on web, is fully supported by the shared backend, and is simply not wired up in the Flutter client.** This is confirmed, not assumed. In this checkout `sahayakai-main` contains, live and present:

- `src/ai/flows/lesson-plan-generator.ts`, `instant-answer.ts`, `worksheet-wizard.ts` — the generative flows, already accepting `imageDataUri` and `ncertChapter`.
- `src/app/api/ai/voice-to-text/route.ts`, `src/app/api/tts/route.ts`, `src/app/api/assistant/route.ts` — the full voice pipeline mobile already calls.
- `src/app/api/content/save/route.ts` (+ `list`, `get`, `download`, `delete`) — the library persistence mobile does not use.
- `src/app/api/attendance/call/route.ts` — the parent phone-call telephony mobile's classifier can't reach.

**Consequence for planning:** the overwhelming majority of this work is Flutter client work — new widgets, new DTO fields, new dispatch logic. Backend/owner actions are the *exception*, and I flag every one explicitly below as **[OWNER/BACKEND]**. Do not let anyone tell you these gaps are "waiting on the API." With three named exceptions (the assistant classifier prompt for the parent loop, offline-plan data porting, and any new server enum values), the API is already there.

### 0.2 Note on file paths — the reviewed build is not this working tree

The audit ran against a Flutter build using a `lib/features/<domain>/{presentation,data,domain}` architecture (`VidyaController`, `VidyaNavDispatcher`, `ToolPrefill`, `SealMic`, `InlineFieldMic`, `ToolScaffold`). **That layout is not present in this checkout** — the on-disk `sahayakai_mobile/lib/` uses an older `lib/src/<feature>/` structure and has none of those symbols. Every mobile path in this plan follows the **reviewed build's** layout (the app under review), because that is the app the founder is judging. First action for any executor: confirm which repo/branch is the reviewed build and point the work there. If the on-disk `sahayakai_mobile` *is* the intended target, add a mapping pass — the gaps are the same, the filenames differ.

### 0.3 Phase labels vs finding IDs — disambiguation

The task groups remediation into tiers **P0–P5**. The findings are *also* numbered **P0–P28**. These are different namespaces. In this document, **"Phase P0…P5"** = remediation tier; **"finding #N"** = the finding whose `id` is `PN` (e.g. finding #22 = the Worksheet LaTeX defect). Sorry for the collision; it's inherited.

### 0.4 Shared building blocks (build once, reused across phases)

Nine findings collapse into a handful of reusable components. Building these first is what makes the per-tool work cheap. Effort is amortized here and *not* re-counted per tool.

| # | Building block | Unlocks findings | Home |
|---|---|---|---|
| **B1** | `autoSubmit` intent threaded through dispatch + guarded auto-run in each tool | #2, #15 + the whole voice-first thesis | `vidya_nav_dispatcher.dart`, `tool_prefill.dart`, every `*_screen.dart` |
| **B2** | Real Markdown + LaTeX render widget (replace `AiText`'s bare `Text`) | #6, #20, #22 | new `lib/shared/widgets/rich_markdown.dart`; `ai_text.dart` |
| **B3** | Client-side PDF/print export | #4, #9, #23 | new `lib/shared/export/pdf_exporter.dart` |
| **B4** | Result-level TTS "read aloud" control | capability census (HEAR half) | new `lib/shared/widgets/read_aloud_button.dart`, reuse `tts_repository.dart` + `audio_player_service.dart` |
| **B5** | Save-to-Library + Share-to-Community client | #3, #9, #17, #25 | new `lib/features/library/`, new community routes |
| **B6** | `ExamplePrompts` + `QuickTemplates` widget (11-language) | #5, #13, #16, #24 | new `lib/shared/widgets/example_prompts.dart` |
| **B7** | Proactive `UsageRemainingBadge` + inline upgrade prompt | #7, #14, #26 | new `lib/shared/widgets/usage_badge.dart` |
| **B8** | Localized grade/subject picker labels | #18 | `picker_options.dart` + l10n arb |
| **B9** | `InlineFieldMic` rollout to the remaining 8 tools | voice-first verdict step 5 | `inline_field_mic.dart` consumers |

---

## Phase P0 — Voice-first end-to-end architecture (the thesis)

**This is the whole report in one phase.** Everything upstream — capture, VAD, STT, the classifier, TTS speak-back, the closed-flow guard, compound-intent chips, the everywhere co-teacher sheet — is at parity or *ahead* of web. The pipe is built and capped one inch from the outlet. Web's `NAVIGATE_AND_FILL` is really `NAVIGATE_AND_FILL_AND_RUN`; mobile implemented the fill and stopped at a sticky **Generate** button. Findings #2 and #15 are the same defect on two tools; it is present on all of them.

### P0.1 — Thread `autoSubmit` through the dispatcher (building block B1)

**Work:** Add a boolean `autoSubmit` to `ToolPrefill` (or carry it alongside the push in `VidyaNavDispatcher.dispatch`). Set `true` on the voice path (single-directive `pendingNavigation` and the confirm-chip `dispatchDirective` path); `false` for manual tool-grid opens.

**Files:** `lib/features/vidya/presentation/vidya_nav_dispatcher.dart:66-72`; `lib/features/vidya/.../tool_prefill.dart`; the two voice entry points `vidya_controller.dart:666-671` (single intent) and `:368-381` (compound chips).

**Effort:** ~0.5 day.

### P0.2 — Guarded auto-run in each tool's `initState`

**Work:** After `_applyPrefill`, if `autoSubmit && <required field present>`, schedule `_submit()` in a post-frame callback (the tools already use `addPostFrameCallback` for `_scrollToResult`). **Gate explicitly on the required field** — web only fires when `topicParam`/`questionParam` exists (`quiz-generator/page.tsx:210`, `instant-answer/page.tsx:312`). A partial utterance ("make a quiz") must land on a form and wait, not submit empty. `_submit()` already validates via `_formKey.currentState.validate()`, so a missing field self-blocks — but gate before it to avoid a validation-error flash.

**Files (per tool):** `lesson_plan_screen.dart:68-100`, `quiz_generator_screen.dart`, `instant_answer_screen.dart:61-99`, `worksheet_wizard_screen.dart`, `rubric_*_screen.dart`, `visual_aid_*_screen.dart`, `virtual_field_trip_*_screen.dart`, `teacher_training_*_screen.dart`. Web's target pattern is uniform across all of these: `use-lesson-plan.ts:274-275`, `quiz-generator/page.tsx:230-232`, `instant-answer/page.tsx:323-325`, `worksheet-wizard/page.tsx:349`, `rubric-generator/page.tsx:161`, `visual-aid-designer/page.tsx:334`, `virtual-field-trip/page.tsx:318`, `teacher-training/page.tsx:221`.

**Effort:** ~0.5 day per tool once the pattern is set → ~3–4 days for the 8 generative tools. Genuinely fast because it is the same ~10-line change each time and the tools share a scaffold.

**Status (2026-07-28) — the last two tools, Worksheet Wizard + Exam Paper, are now wired (B1 complete on all 10):** both screens take a `ToolPrefill? prefill`, seed their fields in `_applyPrefill`, carry the P0 guarded auto-run and the P1 voice-summary auto-speak, and their routes now pass `_prefillOf(state)`. VIDYA *can* route voice to both — the classifier emits `flow: "worksheet-wizard"` and `flow: "exam-paper"` (`src/ai/flows/vidya-assistant.ts` §11 worked examples), and mobile's `VidyaFlow`/`routeForFlow`/`prefillFor` already handled them — **so this is NOT a backend-classifier gap.**

**Honest caveat — neither of these two can complete "speak → result" on its own, by structure, not by omission:**
- **Worksheet Wizard** requires a **textbook photo** (`imageDataUri`), which the voice classifier cannot supply. The auto-run guard therefore gates on `_image != null && prompt` and, on a voice open, correctly **waits** — the teacher lands on a form pre-filled with the prompt/grade/subject and adds only the photo.
- **Exam Paper** requires a **board** selection, and the classifier's `params` schema (`VidyaDirectiveParams`) carries **no board field**. The auto-run guard gates on `_board != null && _grade != null && _effectiveSubject != null` (+ the conditional-chapters rule) and, on a voice open, correctly **waits** — the teacher lands on a form pre-filled with grade/subject/chapter and picks only the board.

In both cases the prefill still delivers most of the form, and the **P1 voice summary auto-speaks once when the result finally lands** (after the teacher supplies the one missing input and taps Generate), so the voice loop still closes. Closing the "speak → result" inch fully for these two would need either an input the voice path cannot capture (a photo) or a new `board` param on the classifier + `VidyaDirectiveParams`/`ToolPrefill` (a small, well-scoped backend + DTO follow-up). Tests: `test/features/worksheet_wizard/worksheet_voice_test.dart`, `test/features/exam_paper/exam_paper_voice_test.dart`.

### P0.3 — Language/grade normalization guard (don't reintroduce the "form English, output Hindi" race)

**Work:** Web pairs auto-submit with `SET_OPTS` + `normaliseVidyaLanguage`/`normaliseVidyaGradeLevel` (`quiz-generator/page.tsx:221-228`). Mobile already has `prefillLocale` (`tool_prefill.dart:65-71`) and `normaliseVidyaLanguage` (`vidya_controller.dart:85-92`). Ensure `_applyPrefill` fully commits `_language`/grade/subject **before** the post-frame submit fires. Because `_applyPrefill` runs in `initState`, state is settled by first frame — safe — but this must be asserted in a test, not assumed.

**Effort:** ~0.5 day (mostly a test).

### P0.4 — Cover the compound path

**Work:** The confirm-chip branch (`dispatchDirective → pendingNavigation`) routes through the same dispatcher, so a chip tap must also auto-run its tool — otherwise "make a quiz AND a worksheet" strands the teacher on two forms.

**Effort:** folded into P0.1/P0.2.

**Honest note on P0:** This is the single highest-leverage change in the entire report and it is genuinely small — steps P0.1–P0.4 are ~1 day of core logic plus ~3–4 days of mechanical per-tool wiring and tests, across ~10 files, with existing tests to extend. It converts "speak → filled form → tap Generate" into "speak → result." **No backend change. No new API.** If only one phase ships, it is this one. What it does *not* do: it does not make the result *speakable* (that's Phase P1/B4) and it does not reach the parent call or graders (that's Phase P2). Voice-first "act" is delivered here; voice-first "hear" is not.

---

## Phase P1 — Missing capabilities (Omni-Orb equivalent, TTS read-aloud, video)

Ranked by thesis impact: read-aloud first (it's the missing HEAR half and reuses infra you already have), then the launcher ubiquity gap, then voice-notes, then video (which is a non-issue — see below).

### P1.1 — Result read-aloud / TTS on the deliverable (building block B4) — **highest impact after P0**

**The sharpest hit to the thesis:** speak-to-generate will work after P0, but generate-to-**hear** is confined to VIDYA's chat sentence. The TTS engine exists and works — `tts_repository.dart:29-35` → `audio_player_service.dart:96-108` (in-memory base64 mp3 via just_audio) — but it has exactly **one** caller: VIDYA's conversational reply (`vidya_controller.dart:651-659`). No tool result view and neither grader can speak its output. Web reads generated output aloud (`assessment-result.tsx:83-118`, wired at `:192`).

**Work:** Build a `ReadAloudButton` that takes result text, chunks it, calls `/api/tts`, and plays via the existing `AudioPlayerService`. Add it to every result view and both grader results. Reuse the exact repository and player already shipped — no new backend.

**Files:** new `lib/shared/widgets/read_aloud_button.dart`; consumers: `lesson_plan_result_view.dart`, `quiz_result_view.dart`, `instant_answer_result_view.dart`, `worksheet_result_view.dart`, `assess_assignment/.../assessment result view`, and the rest. Reuse `tts_repository.dart`, `audio_player_service.dart`.

**Dependencies:** none (backend TTS present). **Watch cost:** TTS is per-call spend; add a length cap and cache the last synthesis so re-taps don't re-bill (mobile already caches VIDYA audio in-memory — reuse that pattern).

**Effort:** ~1.5 days for the button + player wiring; ~0.25 day each to mount on ~10 surfaces → ~4 days total.

**Honest note:** genuinely achievable quickly and it is the difference between "voice-first entry" and "voice-first loop." Do this immediately after P0.

### P1.2 — Omni-Orb equivalent: make the launcher actually omnipresent

**Finding (capability census): PARTIAL.** Web mounts one persistent floating `<OmniOrb />` once in the shell (`app-shell.tsx:119`) so it hovers over every signed-in page. Mobile has no always-on orb; VIDYA is (a) bottom-nav tab 0 and (b) a sparkles app-bar action that `ToolScaffold` injects into the ~20 tool screens (`tool_scaffold.dart:38-42` → `vidya_sheet.dart:30-44`). It is **absent** from Library, Me, inbox, conversation thread, staffroom, and network hub — none of those use `ToolScaffold` (`app_shell.dart:49-57`).

**Work:** Two options. (a) *Cheap:* add the `VidyaAppBarAction` to the app bars of the non-`ToolScaffold` surfaces (Library, Me, inbox, staffroom, network). (b) *Right:* mount a single persistent floating mic overlay in `app_shell.dart` above the `IndexedStack`, matching web's shell-level orb, so it is truly everywhere including scroll views and modals. Recommend (b) — it is the literal Omni-Orb analog and removes the per-surface maintenance burden.

**Files:** `lib/features/dashboard/presentation/app_shell.dart:49-57`; new `lib/features/vidya/presentation/omni_mic_overlay.dart`; reuse `SealMic` + `VidyaController`.

**Dependencies:** none. **Effort:** option (a) ~1 day; option (b) ~2–3 days (overlay positioning, keyboard-avoidance, per-route suppression where a mic would collide).

**Honest note:** option (a) is overnight-doable and closes the "it's missing on 5 tabs" complaint. Option (b) is the real fix and is a 2–3 day job with fiddly layout edge cases (bottom sheets, the conversation composer). Do (a) now, schedule (b).

### P1.3 — Voice-note messaging — **ABSENT, whole modality dropped**

**Finding: ABSENT.** Web ships record → upload → send → play end-to-end: `VoiceRecorder` in the peer inbox and community composers (`voice-recorder.tsx:18-273`, `conversation-thread.tsx:393`, `community-chat.tsx:378`), an `AudioBubble` with a real `<audio>` element (`message-bubble.tsx:128-145`), waveform. Mobile models the audio message type but renders it as a **dead badge** — mic icon + "Voice note" + duration, no playback (`message_bubble.dart:164-166,202-219`), and there is no recorder in either composer.

**Work:** (1) recorder widget in both composers (reuse VIDYA's `record` capture + VAD), (2) upload to the messaging attachment endpoint **[OWNER/BACKEND — confirm the audio-upload route + storage bucket exist for peer/community messages; VIDYA's `/api/ai/voice-to-text` is STT, not attachment storage]**, (3) real `AudioBubble` playback via `AudioPlayerService`.

**Files:** `message_bubble.dart:164-219`; new `voice_recorder.dart`; the inbox and community-chat composers.

**Dependencies:** **the audio-attachment upload/storage path is the one genuine backend question in this phase.** Verify it before scoping; if absent, that is an owner action to build the route + storage rules on `sahayakai-main`. Recording, playback, and the bubble are pure client.

**Effort:** ~3–4 days client, assuming the upload endpoint exists; +2–3 days owner-side if it doesn't. This is teacher-to-teacher/community only — parent comms remain AI-text-draft + AI-phone-call, not recorded notes.

### P1.4 — Video: nothing to do (parity confirmed)

**Finding: ABSENT on both platforms — parity, mobile not deficient.** There is no video *generation* anywhere on web (no veo/text-to-video). Video Storyteller is a YouTube *recommender* on both; neither embeds a player — web `window.open`s the watch URL (`video-storyteller/page.tsx:166-167`), mobile opens it externally (`video_card.dart:24-30`), and the on-card play glyph is decorative (`video_card.dart:210-222`).

**Work:** none required for parity. *Optional* polish: an in-app WebView player instead of an external hand-off (better UX, not a parity gap). **Do not** let "add video generation" enter scope — it is not a web capability and building it is a product decision, not a remediation.

**Effort:** 0 for parity; ~1 day if you want the in-app player.

### P1.5 — Realtime/streaming voice: parity with *shipped* web, leave it

**Finding: ABSENT in-app, but PARITY with production.** Web's low-latency streaming path (`omni-orb-live.tsx:4-31`) is explicitly an **unshipped spike** — "Phase S spike, NOT for production traffic … NOT being imported anywhere." Production web runs the same turn-based typed pipeline mobile does (VAD → STT → `/api/assistant` → `/api/tts`). **No action.** Building Gemini-Live/WebSocket streaming on mobile would put mobile *ahead* of production web — a product bet, not remediation. Note it as a future item, not a gap.

---

## Phase P2 — Parent voice loop ("the AI calls the parent because I asked it to")

**Root cause (voice-first verdict + census):** the voice classifier can't reach the parent phone-call or either grader on *either* platform — a shared 10-flow enum ceiling (`vidya_action.dart:12-22` vs `omni-orb.tsx:26-37`). But the telephony itself is present and working: `parent_hotline_controller.dart:18-36` mirrors the web modal against the same Twilio/Exotel voicebot (`src/app/api/attendance/call/route.ts:10`). So the parent *action* exists; the *voice route to it* does not.

### P2.0 — Voice INPUT on Parent Message — **DONE (2026-07-29)**, no backend

**The founder's specific complaint** was that parent communication is "purely handwritten" when the concept is voice-first. Re-verified against ground truth: the web `KNOWN_FLOWS` set is *exactly* the 10 tool flows (`omni-orb.tsx:26-37`) — there is **no `parent-message` / `parent-hotline` flow on either platform**, so "speak to VIDYA → parent message drafts itself" is a shared product gap (P2.2 below), **not** a mobile parity gap, and building the mobile enum plumbing for it now would be dead code the shared backend never feeds. That trap was avoided.

What *is* non-blocked and directly answers "handwritten" is the **input half** of the parent-message loop, and it is now shipped:

- **Field-mic dictation** (`InlineFieldMic`, the same control five other tools already carry) is wired into Parent Message's three free-text **content** fields — the student's name (`_studentNameController`) and the two situation narratives (`_reasonContextController`, `_teacherNoteController`). A teacher speaks "Ravi missed three days and is behind in fractions" instead of typing it. The closed pickers (subject/reason/parent-language) and the identity/numeric fields deliberately carry no mic.
- Dictation transcribes in the teacher's **own** app language (`localeControllerProvider.code`), *not* the parent's output language — the teacher speaks their tongue; the parent's language still governs only the drafted output.
- The **HEAR** half was already present: `parent_message_result_view.dart:134` carries the P1 `ReadAloudButton`, so the drafted message reads back aloud. **For Parent Message specifically the voice loop is now closed end-to-end — speak the inputs → generate → hear the draft → Copy/Share — with no classifier dependency.**
- Files: `parent_message_screen.dart` (+3 mics, `_dictationLanguage` getter); tests in `parent_message_screen_test.dart` (`group('voice input')`) assert exactly the three content mics render and the closed-choice/numeric fields carry none. `flutter analyze` 0, token_guard PASS, suite 47/47.

What remains (P2.1–P2.3 below) is the *other* voice path — speaking to VIDYA to **trigger** a parent call/message hands-free — which is genuinely blocked on the classifier (P2.2, owner/backend) and, for one-shot dialing, a contacts source (P2.3).

### P2.1 — Extend `VidyaFlow` with `parentHotline` / `parentMessage`

**Work:** Add enum entries to `VidyaFlow` (`vidya_action.dart:12-22`) and the corresponding `routeForFlow` switch entries so a directive can route to the existing parent-call and parent-message screens. The routes already exist; only the enum + switch need the entries (voice-first verdict, step 6).

**Files:** `vidya_action.dart`, `vidya_nav_dispatcher.dart` (`routeForFlow`).

**Effort:** ~0.5 day client.

### P2.2 — Teach the classifier to emit the new directives — **[OWNER/BACKEND]**

**Work:** The mobile enum guard *drops* any directive the backend doesn't know to emit. `/api/assistant` (`sahayakai-main`) must be taught — in its prompt and output schema — to classify "call Ravi's mother about his attendance" into a `parentHotline` directive with structured params. **This is the one hard backend dependency in Phase P2** and it must respect the standard deploy path (owner action; do not raw-deploy). Until this ships, P2.1 is inert — the enum can receive a directive the server never sends.

**Effort:** ~1–2 days owner-side (prompt + schema + eval), plus deploy.

### P2.3 — Parameter extraction & contact resolution — the honest hard part

**Work:** "Call Ravi's mother" requires resolving *Ravi* → a phone number. If a class roster / contact source exists on mobile, map `{studentName} → {guardianPhone}` and pass to the attendance-call params. If it does not, the flow **must degrade gracefully** to opening the parent-call screen *prefilled with what was understood* (student name, intent) and let the teacher confirm/complete the number — not silently fail, and never auto-dial an unresolved number.

**Dependencies:** roster/contacts data source **[OWNER — confirm whether a student roster with guardian numbers exists in the mobile data layer]**.

**Effort:** ~1 day if a roster exists; the degrade-to-prefilled-screen path is ~0.5 day and should ship regardless.

**Honest note on P2:** the *plumbing* (P2.1) is trivial and the telephony is done. The blockers are real and not client-side: the classifier must learn the intent (owner/backend, ~1–2 days + deploy), and true one-shot dialing needs a contacts source that may not exist. A realistic quick win is **"speak → parent-call screen opens, prefilled, teacher taps Call"** — not "speak → phone rings" — and I would not promise the latter overnight. Safety also argues for a human-in-the-loop confirm before any autonomous outbound call to a parent; keep the final Call tap.

---

## Phase P3 — Onboarding rebuild

**Founder's verdict ("terrible") is substantially correct.** The divergence from web is choreography and payoff, and it lands against the voice-first thesis.

### P3.1 — Kill the duplicate language step

**Work:** Mobile asks for language **twice, back to back** — the `LanguageSwitcher` on login (`login_screen.dart:155-168`) and then onboarding step 0's 11-item radio list ("Which language do you teach in?", `onboarding_screen.dart:528-575`) — both writing the same `AppLocale`. Web asks **once** as step 0 and **pre-selects from `navigator.language`** so the teacher only confirms (`page.tsx:343-350, 570-607`). Collapse to one: pre-select from the device locale on mobile, present it as a confirm-not-choose, and remove the redundant step.

**Files:** `login_screen.dart`, `onboarding_screen.dart:528-575`, `onboarding_controller.dart`.

**Effort:** ~1 day. Quick, high-perceived-quality win.

### P3.2 — Device-locale pre-selection + mother-tongue greeting

**Work:** Pre-fill the profile language/state defaults from the device locale (web reads `navigator.language`; mobile has `Platform.localeName`/`ui.window.locale`). Web opens with a mother-tongue greeting (`mother-tongue-greeting.tsx:72`) — port an equivalent so the first screen speaks the teacher's language back to them. This is a voice-first-brand moment, not just cosmetics.

**Effort:** ~1 day (greeting reuses B4/TTS if you want it spoken).

### P3.3 — Voice-drivable profile capture (stretch)

**Work:** The teacher profile (name, school, board, state/district, subjects, grades, admin role, language, phone/pincode) is the same set on both platforms. Let VIDYA fill it by voice — the same `ToolPrefill` mechanism from Phase P0, pointed at the onboarding form, with the same guarded auto-advance. This makes onboarding itself voice-first instead of a keyboard-era form.

**Dependencies:** builds on Phase P0's B1 (auto-submit/prefill plumbing) and P2.2's classifier work if you want free-form "I teach class 6 science in Bengali in Siliguri" parsing **[OWNER/BACKEND for the parsing intent]**.

**Effort:** ~2–3 days; the free-form parse is the expensive part and is owner-dependent.

**Honest note on P3:** P3.1 + P3.2 are a clean, fast, obviously-better rebuild (~2 days, no backend) that answers "terrible." P3.3 is the genuinely differentiated version and is a multi-day effort gated on the same classifier work as Phase P2. Ship P3.1/P3.2 now; treat P3.3 as a fast-follow.

---

## Phase P4 — Output-fidelity + parameter/input parity per tool

This is the long tail — the bulk of the numbered findings. Organized by shared building block, because per-tool cost collapses once the block exists. **Everything here is client-side; the flows already accept every input and the save endpoint already exists.**

### P4.1 — Markdown + LaTeX rendering (building block B2) — findings #22, #6, #20

**Work:** Replace `AiText`'s bare `Text` (`ai_text.dart:13-38`) with a real renderer. Two capabilities:
- **LaTeX** (finding #22, **high**): the worksheet flow is *instructed* to emit ALL math as `$…$` (`worksheet-wizard.ts` rule 5), and mobile prints raw dollar-sign markup — every math worksheet looks broken. Web typesets via `remark-math`/`rehype-katex` (`worksheet-display.tsx:6-8,131-136`). Add a Flutter math renderer (`flutter_math_fork` or equivalent) behind the same widget.
- **Inline markdown** (findings #6, #20): bold/italic/links/blockquote. Web uses `renderMarkdown` (`lesson-plan-display.tsx:31-38`) and CommonMark `ReactMarkdown` (`instant-answer/page.tsx:567`). Mobile's hand-rolled parser drops link URLs (`answer_markdown.dart:239-241`) and has no blockquote block (`:59-98`). Use a maintained Flutter markdown package rather than extending the hand-rolled parser.

**Files:** new `lib/shared/widgets/rich_markdown.dart`; swap in at `ai_text.dart:25-36`, `worksheet_result_view.dart:90-105`, `lesson_plan_result_view.dart:80,363`, `instant_answer_result_view.dart`.

**Effort:** ~2–3 days (package selection, theming to match the design system, the math edge cases). **Honest note:** LaTeX rendering in Flutter is real but the packages are less mature than KaTeX — budget time for glyph/spacing QA on actual generated worksheets, and have a plain-text fallback for parse failures so a bad `$…$` never crashes the view.

### P4.2 — PDF / print export (building block B3) — findings #23, #9, #4

**Work:** Web exports rendered results to shareable/printable PDF via client-side `jspdf`+`html2canvas` (`exportElementToPdf`, used across all display components; confirmed **no server route** — `content/download` returns JSON only). On mobile this is the *actual deliverable* for worksheet (#23, **high**) and quiz (#9, **high**), and missing on lesson plan (#4). Mobile currently only copies plain text. Implement with Flutter's `printing` + `pdf` packages: render the result widget tree (or a print-specific layout) to PDF, with the quiz getting a **separate answer-key page** and "Generated by SahayakAI" branding to match web (`quiz-display.tsx:823-879`).

**Files:** new `lib/shared/export/pdf_exporter.dart`; wire into `worksheet_result_view.dart:135-189`, `quiz_result_view.dart:198-221`, `lesson_plan_result_view.dart:124-170`. Add `pdf`/`printing` to `pubspec.yaml` (grep confirms neither is present today).

**Dependencies:** none (client-side, mirrors web's architecture). **Effort:** ~3 days for the exporter + branded templates; ~0.5 day per tool to wire. **Honest note:** getting a *print-quality* PDF (page breaks, the answer-key second page, LaTeX inside the PDF) is more than a one-liner — the LaTeX-in-PDF path depends on B2 and needs its own QA. A "good-enough text/table PDF" is quick; a "print-shop-ready handout" is a few days.

### P4.3 — Save-to-Library + Share-to-Community (building block B5) — findings #9, #3, #17, #25

**Work:** Web persists results (`POST /api/content/save`, present) and offers Share-to-Community CTAs on every result (`quiz-display.tsx` save/share, `worksheet-display.tsx:119-121`, `instant-answer/page.tsx:550-583`). Mobile result bars are Regenerate + Copy only. Build a `SaveToLibrary` action (calls the existing endpoint) and a Library feature to view saved items, plus a Share-to-Community path — **which requires community-library/submit-content routes that do not exist in the mobile router** (`routes.dart` has none). Save is cheap; community share is a small feature build.

**Files:** new `lib/features/library/`; new community routes in `routes.dart`; wire into every `_ActionBar`. Reuse `content/save`, `content/list`, `content/get`.

**Dependencies:** Save endpoint present. Community submit/read endpoints **[OWNER — confirm the community-content POST/GET routes exist on `sahayakai-main`; the web CTAs imply they do, verify before scoping the share path]**.

**Effort:** Save + Library view ~3 days; Share-to-Community ~2–3 days on top (new routes + screens). **Note:** Instant Answer already auto-persists server-side (`instant-answer.ts:241-289`), so its explicit Save is lower priority — the answer already reaches the library; only the *button* and the share path are missing.

### P4.4 — Context-image input — findings #10 (quiz), #0 (lesson plan)

**Work:** Both flows accept `imageDataUri` server-side — the quiz schema literally calls it "the primary context for the quiz" (`quiz-generator-schemas.ts:15-17`); the lesson flow reads `{{media url=imageDataUri}}` (`lesson-plan-generator.ts:29-31,338-341`). This is the core rural/low-text use case: photograph a textbook page, generate from it. Mobile forms have no image/camera field and the request DTOs have no `imageDataUri` key (the quiz DTO even has a comment "imageDataUri is P2 and intentionally omitted", `quiz.dart:45`). Add an image picker/camera row, base64-encode to a data URI, add `imageDataUri` to `QuizRequestDto` (`quiz_dtos.dart:12-52`) and `LessonPlanRequestDto` (`lesson_plan_dtos.dart:11-46`), send it.

**Files:** the two screens (`quiz_generator_screen.dart:165-194`, `lesson_plan_screen.dart:153-178`), both DTOs. Add `image_picker` to `pubspec.yaml`.

**Dependencies:** none (backend accepts it today). **Effort:** ~2 days (picker + camera + encode + DTO + two forms). **Honest note:** straightforward and high-value; the only care needed is image size/compression before base64 to keep request bodies and cost sane.

### P4.5 — NCERT chapter linking — finding #1 (lesson plan)

**Work:** Web's `NCERTChapterSelector` attaches `{title, number, learningOutcomes}` and rewrites the topic (`lesson-plan-sidebar.tsx:194-211`), driving the NCERT-ALIGNMENT prompt block (`lesson-plan-generator.ts:37-42,332-336`) — a core India-curriculum differentiator. Mobile omits it entirely; NCERT types exist only in the VIDYA action DTO and video_storyteller, never wired into the lesson form. Port the selector, add `ncertChapter` to `LessonPlanRequestDto`.

**Dependencies:** NCERT chapter dataset source — **[OWNER — confirm the chapter list the web selector reads from is available to mobile (bundled asset or an endpoint)]**. **Effort:** ~2 days client if the data source is available; the data-source question is the gate.

### P4.6 — Localized grade/subject labels (building block B8) — finding #18

**Work:** Mobile prints raw English API enums ("Class 6", "Mathematics") regardless of UI language (`instant_answer_screen.dart:218,239` rendering `kGradeLevels`/`kSubjects` from `picker_options.dart:11-44`) — a direct violation of the 11-language mandate. Web resolves every label through the l10n dict (`grade-level-selector.tsx:51`, `subject-selector.tsx:26`). Add a display-label lookup that keeps the English *value* for the API but shows a localized *label*. This touches every tool's grade/subject dropdown, so do it as a shared helper.

**Files:** `picker_options.dart` + arb files; the dropdown builders across tools. **Effort:** ~1.5 days (the l10n strings for 11 languages × grades × subjects are the bulk — much is likely already translated on web and can be lifted).

### P4.7 — Editable results (finding #11, quiz) — deliberately deferred

**Work:** Web's quiz result is an editable workspace — inline-edit title/questions/options/answer, add questions, per-question refine, thumbs feedback (`quiz-display.tsx` throughout). Mobile is read-only; the only mutation is whole-quiz Regenerate. This is real parity loss but it is a **large** build (inline editing state, per-question re-roll calls, add-question flows).

**Effort:** ~4–5 days for the quiz alone. **Honest note:** genuinely useful, genuinely not quick. This is the one P4 item I would explicitly *not* attempt in a compressed timeline — it is a feature, not a wiring gap. Schedule it; don't crash it.

---

## Phase P5 — Design / content parity

Lower severity, high perceived-quality, mostly cheap once the shared widgets exist.

### P5.1 — Example prompts + quick-start templates (building block B6) — findings #5, #13, #16, #24

**Work:** Web scaffolds discovery with tappable localized "Quick Ideas" (`ExamplePrompts`, 11-language table in `example-prompts.tsx`) and "Quick Start Templates" that populate topic/grade in one tap — key low-friction onboarding for low-literacy teachers, and it reinforces the "just ask" voice-first framing. Mobile shows bare fields with hints on lesson plan (`lesson_plan_screen.dart:183-204`), quiz, instant answer (`instant_answer_screen.dart:159-173`), and worksheet (`worksheet_wizard_screen.dart:190-207`). Build one `ExamplePrompts` widget driven by a per-page 11-language map (liftable from `example-prompts.tsx`) and mount on all four+.

**Effort:** ~2 days for the widget + the string map; ~0.25 day per mount. Cheap and visible.

### P5.2 — Descriptive framing / tool subtitles — findings #19, #13

**Work:** Web gives each tool an icon, title, and localized one-line description (e.g. instant answer's "Get quick, expert answers…", `instant-answer/page.tsx:421-429`; quiz's CardDescription, `page.tsx:350`). Mobile shows only the app-bar title — and in the instant-answer case the subtitle string *already exists in l10n* (`instantAnswerSubtitle`, `app_en.arb:762`) but is never rendered. Add a subtitle slot to `ToolScaffold` (`tool_scaffold.dart:41-43`) and populate it.

**Effort:** ~1 day across tools (strings largely exist).

### P5.3 — Pedagogical-strategy panel (finding #13, quiz)

**Work:** Web renders a live "Pedagogical Strategy" panel explaining each selected Bloom's level (`quiz-generator/page.tsx:588-606`); mobile reduces Bloom's to bare chips + one generic hint. Port the per-level explanatory text.

**Effort:** ~0.5 day (content, not code).

### P5.4 — Proactive usage badge (building block B7) — findings #7, #14, #26

**Work:** Web shows remaining-quota badges + inline upgrade prompts *before* the wall (`UsageRemainingBadge`/`UpgradePrompt` on quiz/worksheet/lesson forms). Mobile only surfaces limits *reactively*, as an error card after a 429/403 (`*_error_view.dart`). Build a `UsageRemainingBadge` reading the usage state mobile already has and mount on the forms.

**Dependencies:** a usage/quota read — **[OWNER — confirm mobile can read remaining-quota before submit; if the count only comes back on a 429, an endpoint/field may be needed]**. **Effort:** ~1.5 days client if the count is readable; the data availability is the gate.

### P5.5 — Feedback affordance (findings #11, #27)

**Work:** Web attaches a per-result `FeedbackDialog` (`worksheet-display.tsx:123-129`, quiz thumbs + dialog). Mobile has none. Add a small feedback control to result footers. **Dependencies:** feedback submit endpoint **[OWNER — confirm route]**. **Effort:** ~1 day client.

### P5.6 — Offline generation fallback (finding #8) — lower priority

**Work:** Web serves pre-written offline lesson plans keyed by NCERT chapter (`use-lesson-plan.ts:386-409`, `src/data/offline-lesson-plans.ts`) so a plan appears with no connectivity; mobile treats offline purely as an error (`lesson_plan_error_view.dart:43`, OfflineView retry only). Port the offline dataset as a bundled asset and serve it on network failure keyed by the selected chapter.

**Dependencies:** depends on P4.5 (chapter selection exists) and the offline dataset being portable. **Effort:** ~1.5 days. **Honest note:** this only works for lesson plans that map to a known chapter; it is not general offline generation and shouldn't be sold as such (consistent with the standing "do NOT claim offline GA" rule).

---

## Phase dependency & sequencing summary

```
P0 (auto-submit)  ──────────────► delivers the "act" half of the thesis. Do first.
   │
   ├─ B4 read-aloud ─► P1.1 ─────► delivers the "hear" half. Do second.
   │
   ├─ B2 markdown/LaTeX ─► P4.1 ─► fixes broken math/formatting output
   ├─ B3 pdf ──────────► P4.2 ───► delivers the actual print artifact
   ├─ B5 library/share ► P4.3 ───► makes results persist/shareable
   │
P2 (parent loop) ── needs [OWNER] classifier work; ship the "prefilled screen" degrade now
P3 (onboarding)  ── P3.1/P3.2 independent & quick; P3.3 needs P0 + [OWNER] classifier
P4/P5 ─────────── long tail, mostly independent, cheap once B1–B9 exist
```

**Rough total effort (single senior Flutter engineer, sequential):** P0 ≈ 1 week · P1 ≈ 1.5–2 weeks · P2 ≈ 3–4 days client + owner/backend · P3 ≈ 2 days (core) + fast-follow · P4 ≈ 2.5–3 weeks · P5 ≈ 1.5 weeks. **Call it ~7–9 weeks of focused client work to full parity**, of which the thesis-defining slice (P0 + P1.1) is ~2 weeks. Parallelizes well across 2–3 engineers because the shared building blocks are the only serialization point.

---

## The blunt part: what a realistic overnight run can and cannot deliver

**First, the disqualifying mechanical facts — no hand-waving:**

1. **The reviewed Flutter build is not in this working tree.** `VidyaNavDispatcher`, `ToolPrefill`, `SealMic`, `InlineFieldMic`, `ToolScaffold`, the `lib/features/<domain>/` layout — none of it exists in this checkout (`sahayakai_mobile/lib/` is a different, older `lib/src/` structure). **An overnight agent pointed at this directory would touch the wrong app.** Step zero is confirming and checking out the correct repo/branch. Until that's done, *nothing* ships.
2. **Verification needs a device or emulator and a human's eyes.** Flutter parity work — LaTeX glyphs, PDF page breaks, a mic overlay that doesn't collide with the keyboard, a spoken result that actually plays — cannot be validated by `flutter analyze` alone. An overnight run can write and compile the code; it cannot confirm the worksheet *looks right* or the answer *sounds right*. That is a morning-after human QA pass, mandatory.
3. **Every backend/owner item is off-limits to an autonomous run.** The parent-loop classifier (P2.2), any new server enum, and prompt changes touch `sahayakai-main` production and are governed by the deploy-safety rule (no raw `gcloud run deploy`; dual-region; audit before/after). Those are human-gated by policy. An overnight run must stop at the client boundary and *flag* them, not attempt them.

**What one overnight run realistically CAN deliver** (correct repo assumed, client-only, tests + compile as the bar):

- **Phase P0 in full** — `autoSubmit` plumbing (B1) + guarded auto-run wired across the 8 generative tools + the normalization guard + the compound-chip path. This is the single most important change in the report, it is ~10 mechanical files following one pattern, and it converts "speak → filled form → tap Generate" into "speak → result." **This is the achievable headline.**
- **P1.1 read-aloud (B4)** on the main result views — the TTS engine, repo, and player already exist and have a working caller to copy; adding a button and mounting it is very doable in the same run. Delivers the "hear" half.
- **The cheap, self-contained content items:** P3.1 duplicate-language-step removal, P5.2 subtitles (strings already exist), P5.3 Bloom text, and the P1.2(a) launcher-on-missing-tabs fix.
- **The scaffolding** for B2/B3/B6 (widgets stubbed, packages added, one tool wired as the reference implementation) even if not rolled out everywhere.

**What one overnight run CANNOT deliver — do not promise these:**

- **A print-shop-ready PDF with LaTeX** (P4.2 + B2 together). LaTeX-in-Flutter and LaTeX-in-PDF each need real QA on real generated worksheets; overnight you get a plausible first cut and literal-asterisk edge cases, not a validated artifact.
- **The true one-shot parent call** (P2). The telephony is done but the classifier that routes voice → call is a backend/owner change plus a contacts-resolution question. Overnight you can ship the *degrade* ("speak → parent-call screen opens prefilled → teacher taps Call"), which is the honest and safe version, and which I'd argue you *want* a human tap on anyway before an autonomous outbound call to a parent.
- **Editable quiz results** (P4.7), **voice-note messaging** (P1.3, gated on an attachment-upload endpoint), the **persistent floating Omni-Orb overlay** (P1.2b), and **Share-to-Community** (P4.3, needs new routes). These are features, not wiring — days each, with genuine edge cases.
- **Anything requiring the founder to confirm the backend surface** — NCERT dataset access (P4.5), community endpoints (P4.3), pre-submit quota reads (P5.4). An autonomous run should surface these as blocking questions, not guess.

**Bottom line:** point a single overnight run at the correct repo and you can wake up to a mobile app that is genuinely voice-first *end-to-end for generation* (P0) and that *speaks its results back* (P1.1) — which is exactly the founder's thesis, and exactly the two things the report says are missing at the payoff. Everything else in this plan is real, is mostly client-side because the backend is already built, and is a matter of weeks — but it is daylight-and-human-QA work, not magic that happens while you sleep. The pipe is built and capped one inch from the outlet; overnight, you can uncap it. You cannot, overnight, re-plumb the whole house.