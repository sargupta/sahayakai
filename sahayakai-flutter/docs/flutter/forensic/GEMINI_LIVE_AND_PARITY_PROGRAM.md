# Gemini Live + Web-Parity Program (Flutter / Android)

**Founder directive:** 2026-07-29. **Status:** active, autonomous `/loop`.
**Scope:** all work in the Flutter app at `/Users/sargupta/SahayakAIV2/wt-flutter-rebuild/sahayakai-flutter`, branch `feature/flutter-rebuild`.

## Hard constraints (this session)

- **Android/Flutter ONLY.** No changes to the web app (`sahayakai-main`), no `main` branch, no production deploy. `sahayakai-main` stays READ-ONLY reference (for the backend contract + the web Gemini Live spike to learn from). Founder chose "Android only for now."
- **Gemini Live is ADDITIVE, not a replacement.** The existing Gemini-API turn-based voice pipeline (STT `/api/ai/voice-to-text` → classifier `/api/assistant` → TTS `/api/tts`, played via `audio_player_service`) is **kept as the fallback** — never deleted. Live is feature-flagged; when Live is unavailable, disabled, or errors, the app falls back to the turn-based pipeline. Founder: "do not delete gemini API related part, keep that as fallback option."
- **Video:** stays a YouTube curator (Video Storyteller). No generation. No work. Founder confirmed.
- **End goal:** the mobile app aligned with the web app — **colours, style, and icons matching**.
- **Honesty:** "Gemini Live works perfectly on Android" is a multi-day arc needing on-device audio testing + iteration, NOT a one-night claim. Never report Live "working" without a real end-to-end device verification. Keep the fallback path green at all times.

## Priority: "everything, equal" — interleave the four workstreams

Each loop iteration is still ONE focused, gated, committed unit; rotate across the workstreams rather than finishing one before starting another. Gate every unit: `flutter analyze` 0, `token_guard` PASS, relevant tests green (`flutter test --timeout 90s`), and a FULL-SUITE check (only the ~13 known create_palette failures) whenever shared/i18n/voice code is touched. Commit explicit paths, single-word conventional scope, no attribution, drift `.g.dart` unstaged, push.

### WS1 — Attendance → Parent Call (net-new Flutter feature)

**Why:** the Flutter parent-hotline roster is hardcoded-empty because the app has no Attendance. The web has full Attendance (`sahayakai-main/src/app/attendance/*` → class → students → marks → call-parent; `/api/attendance/*`). Building Attendance on mobile gives the roster that feeds parent-hotline, and "mark absent → call the parent" is the real entry to the parent-call flow.

**Steps (verify-first each):** find the roster/classes/students **data source** the web attendance pages read (Firestore collection vs a REST route — check `firestore.rules` + `/api/attendance/*` + the attendance pages); build the mobile Attendance screens mirroring the web structure; wire the roster into `hotlineStudentRosterProvider` (currently the empty seam) so parent-hotline lists real students; add "call parent" from an attendance row. Flag any genuinely backend-only piece (e.g. a roster route that doesn't exist) rather than faking it.

**FINDING (2026-07-29) — WS1 mobile build is BACKEND-BLOCKED; needs REST routes (owner work on `sahayakai-main`, out of scope this Android-only session).** The roster is entirely behind Next.js **server actions** (admin SDK): `getClassesAction` reads `classes` (fields incl. name/grade/section), `getStudentsAction` reads the `classes/{classId}/students` subcollection (each student carries a full `parentPhone` in E164), plus `createClassAction`/`addStudentAction`/`updateClassAction`/`deleteClassAction` (`src/app/actions/attendance.ts`). There is **no client-readable Firestore rule** for `classes`/`students` (verified — and there must not be one: it would expose parent-phone PII directly to clients, exactly what the server-action boundary prevents), and **no REST route** returns the roster (`/api/attendance/*` are all call/outreach mechanics: call, call-context, call-summary, outreach, twiml, transcript-sync — not roster CRUD). The parent-CALL path itself IS reachable (parent-hotline already drives `/api/attendance/*`); only the *who-to-call roster* is missing.

**Backend punch-list to unblock (for whoever owns `sahayakai-main` next):** authenticated REST wrappers of the existing server actions — `GET /api/attendance/classes` (→ `getClassesAction`), `GET /api/attendance/classes/{classId}/students` (→ `getStudentsAction`, returning a **masked** parent phone: last-4 only, mirroring the hotline's F9-001 rule — never the full number to the client), and `POST`/`PATCH` equivalents for create-class / add-student / mark-attendance if mobile is to write. Once those land, the mobile build is: an Attendance feature (class list → students → mark → "call parent") + feed the students into `hotlineStudentRosterProvider`. Until then WS1's mobile UI cannot be honestly built (a client-side roster read is neither available nor safe). **Status: blocked; rotate to WS2/WS3/WS4.**

### WS2 — Worksheet math: critical review + LaTeX rendering

**Why:** the worksheet flow is instructed to emit ALL math as `$…$` LaTeX (`worksheet-wizard.ts` rule 5); mobile's `AiText` prints it raw, so every math worksheet looks broken (finding #22, high). Web typesets via KaTeX.

**Steps:** FIRST a critical review — generate/inspect real worksheet output, catalogue exactly what breaks (LaTeX, markdown, tables, alignment) and how badly, across the result views that use `AiText`. THEN implement a shared rich renderer behind `AiText`/a new `rich_markdown.dart`: a maintained Flutter markdown+math package (evaluate `gpt_markdown` — handles LLM markdown + LaTeX — vs `flutter_markdown`+`flutter_math_fork`), themed to the design system, with a **plain-text fallback on parse failure** so a bad `$…$` never crashes the view. Roll out highest-impact-first (worksheet, then lesson/quiz/exam/rubric). NOTE: immature Flutter math packages need **visual QA on real worksheets** — screenshot the rendered output on the emulator as proof; flag glyph/spacing issues for founder review rather than claiming pixel-perfect.

**CRITICAL REVIEW (2026-07-29) — confirmed broken, high severity.** The backend *instructs the model to emit all math as LaTeX*: `worksheet-wizard.ts` rule 5 — "Use LaTeX for ALL mathematical formulas. CRITICAL: Wrap ALL LaTeX in dollar signs: `$ formula $` for inline or `$$ formula $$` for blocks" — and the activity schema field says "Use LaTeX for math." Mobile then renders that content as **plain text**: `worksheet_result_view.dart` pipes `activity.content` (line ~395), `entry.answer` (~475), `studentInstructions` (~95) and learning objectives (~344) all through `AiText` (a bare `Text`). Consequence: a fractions/algebra/geometry worksheet shows literal `$\frac{1}{2}$`, `$x^2$`, `$$\int_0^1 x\,dx$$` to the teacher — **every math worksheet is visibly broken**, precisely the tool most needed by a rural math teacher. Same latent exposure anywhere else `AiText` carries model prose that may contain `$…$` or markdown (lesson/quiz/exam/rubric), though worksheet is the only flow *instructed* to always emit LaTeX. **Implementation target:** a shared math+markdown renderer (recommend `gpt_markdown` — actively maintained, built for LLM output, supports inline `$…$` and block `$$…$$` + markdown; `flutter_markdown` is discontinued) behind `AiText`, themed, plain-text fallback on parse error, worksheet first, with emulator screenshots as visual proof + glyph/spacing flagged for founder review.

### WS3 — Design parity with web (colours, style, icons)

**Why:** founder wants the mobile app visually aligned with web — colour codes matching, style matching, icons matching.

**Steps:** audit the mobile design tokens (colours in `app_theme.dart`, the production saffron `#E0924D` per memory, typography Outfit/Inter) against the web's tokens (`sahayakai-main` globals/tailwind); produce a parity matrix (token-by-token, screen-by-screen); apply the **mechanical** matches (colour tokens, icon swaps to the web's set, spacing) as gated units; **flag judgment calls** (where mobile deliberately diverges for a native pattern) for founder review rather than unilaterally overriding an intentional choice. Icons: web uses Lucide; mobile uses `lucide_icons` — reconcile any mismatched glyphs per screen.

### WS4 — Gemini Live audio-to-audio (Flutter, additive, fallback to TTS/STT)

**Why:** founder wants real-time audio-to-audio (speak → the assistant speaks back live), opening with a **mother-tongue greeting** in the teacher's selected/device language.

**NON-NEGOTIABLE — Live must still TAKE ACTIONS, not just talk.** It has to do everything VIDYA does today: answer questions, generate content, route to the right tool/flow, prefill + auto-run, message/call a parent, navigate — the same action set the current classifier emits. So the Live session **declares the app's tools as function-calling declarations** (mirroring the current `VidyaAction`/`NAVIGATE_AND_FILL_AND_RUN` directive set + the 10 tool flows) and, when Gemini emits a tool/function call over the Live socket, the client **dispatches it through the EXISTING action pipeline** (`VidyaNavDispatcher.routeForFlow` + `ToolPrefill` + the RUN-verb auto-run). Audio replaces the STT→TTS *transport*; the action/dispatch layer stays exactly as-is. A Live path that only speaks and cannot act is a regression, not the feature. Founder: it "should take necessary actions based on user requests like answering, generating contents, going to different flows, taking actions accordingly as it has been doing currently." Prod web today is still STT-TTS (not Live) — do not assume otherwise.

**Reference:** the web spike `sahayakai-main/src/components/omni-orb-live.tsx` (301 lines) — browser ↔ Gemini Live over a WebSocket, mic PCM in / audio + tool-calls out, 24kHz AudioContext, ephemeral-token auth, `responseModalities: ["AUDIO"|"TEXT"]`, gated behind `voice_mode === "live"`. Study it for the protocol/contract.

**Steps (honest, multi-iteration):** (1) an ephemeral-token backend contract check — Live needs a short-lived token minted server-side from `GEMINI_API_KEY`; find or specify the route (if it doesn't exist on mobile's reachable API, that's a backend/owner item — flag it). (2) A Dart Gemini Live client (WebSocket + mic PCM capture via `record` + playback via an audio track), **behind a feature flag**, that FALLS BACK to the existing turn-based pipeline when Live is off/unavailable/errors. (3) The mother-tongue greeting as the session opener in the teacher's language. (4) On-device verification on the emulator (mic → live audio round-trip) before any "works" claim; keep the fallback path green throughout. Do NOT delete `tts_repository`/`voice_to_text`/`audio_player_service` — they are the fallback.

## Interleave order (rotate; one gated unit per iteration)

WS1 roster-source recon → WS2 worksheet critical review (read-only) → WS3 design-token parity audit → WS4 spike study + ephemeral-token contract → then execute the highest-ready unit from each in rotation. Document-before-code: each workstream gets its findings recorded here before its code lands.

## Blockers / founder items (flag, don't fake)

- Gemini Live API key must have **Live API** access enabled (founder unsure) — scaffold and flag if a live test fails; the fallback keeps voice working regardless.
- Any roster/attendance piece with no mobile-reachable backend route → flag as owner/backend.
- Web parity items where mobile intentionally diverges → founder design call.
- The web-side Gemini Live (production) is explicitly OUT of scope this session (founder: "Android only for now").
