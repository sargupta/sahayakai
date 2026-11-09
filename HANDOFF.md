> **Update 2026-11-07:** the move to `riya-outbound-staging` is under way; backend is live there. Current state and next steps: `C:/Users/shree/handoffs/sahayakai-riya-migration.md`.

# Handoff: SahayakAI Flutter — UX map, Community + parent calling (2026-11-05)

## 1. Goal
Bring the Flutter app (`C:\Users\shree\sahayakai-flutter`, Android) in line with the "SahayakAI UX Map"
artifact (https://claude.ai/artifact/1B98eV3d5fZDsTJrZacR4T; local copy of its screen code:
`%TEMP%\claude\C--Users-shree\62265704-3b7f-41bd-8e0f-eb2c179c83f1\scratchpad\artifact-files\016a72f9-...\app.js`,
its CSS in `index.html` next to it). User's bar: "make no mistakes, leave no corners". Superiors asked for
**special attention on Community and parent calling: flawless and functional**.

Interactive prototype of both areas (sample data, scenario switches, request log), built from the app's own
screens: https://claude.ai/artifact/EdcbQqFCaX3XWadf8iUjMG — source `design/prototype/sahayak_community_calling.html`
(update by publishing the same file path).

## 2. Git state (branch `feat/ux-map-home-dock`) — COMMITTED AND PUSHED 5 Nov
- Commits on top of `bc9ceb12`: `6d85cbd7` strings · `11f0b12a` map design system + tools ·
  `23cc8059` Community · `73cbff31` parent calling · `15748e9a` floating VIDYA orb · `8e925f8e` goldens +
  prototype · `6ff5930a` segmented contrast test · `21504206` merge of `fix/p0-6-openrouter-key` (P0.6:
  no OpenRouter key/direct model calls; VIDYA keeps `_vidya.ask`).
- Pushed to BOTH `origin` (Sachitt-AV-08/sahayakai-flutter) and `upstream` (sargupta/sahayakai), branch
  `feat/ux-map-home-dock` at `21504206`.
- PR: https://github.com/Sachitt-AV-08/sahayakai-flutter/pull/2 (base `master`, mergeable, no auto-merge;
  the fork has no CI checks). PR #1 (earlier work) was already merged.
- Still uncommitted on purpose: `lib/features/vidya/data/dto/transcript.dart` (user's own edit) and this
  `HANDOFF.md`. `stash@{0}` (helper WIP) is fully contained in the commits — safe to drop.
- **Still to do:** message the "SahayakAI design artifact plan" session with the SHAs, test results
  (2243 pass / 2 pre-existing dark-contrast fails; after merge 296 VIDYA + key tests pass) and the PR link —
  it was not running on 5 Nov, so the message could not be delivered.

## 3. Backend outage (root cause found) and the GCP move (ON HOLD)
- sahayakai.com and all Cloud Run services in `sahayakai-b4248` return 503 because **the project's billing
  account (`016D07-151EC3-C60CAE`) is disabled** — Cloud Run logs: "The request failed because billing is
  disabled for this project." Services are otherwise Ready. Re-enabling that billing account restores
  everything with no migration.
- User asked to move the essentials to their colleague's project `riya-outbound-staging` (number
  966091633060, billing on). **Blocked/on hold:** `shree23kadam@gmail.com` only has view access; Owner (or
  Editor + Project IAM Admin + Secret Manager Admin) was requested. Nothing has been created in either
  project. Plan when unblocked: enable firebase/firestore/run/cloudbuild/artifactregistry/secretmanager/
  identitytoolkit/securetoken/generativelanguage/firebaserules/apikeys; add Firebase; Firestore (default DB,
  asia-south1) + rules/indexes from `sahayakai-main/firestore.*`; secrets (GOOGLE_GENAI_API_KEY, FIREBASE_
  SERVICE_ACCOUNT_KEY, SAHAYAKAI_REQUEST_SIGNING_KEY, PROFILE_COMPLETE_COOKIE_SECRET, CRON_SECRET); one
  Cloud Run service from `sahayakai-main/Dockerfile`, min 0 / max 3, 1 CPU / 2 Gi. **Backend code change
  needed first:** `src/middleware.ts` hard-codes `PROJECT_ID = 'sahayakai-b4248'` (token issuer/audience) —
  read it from `NEXT_PUBLIC_FIREBASE_PROJECT_ID`; also `next.config.ts` auth rewrites, `src/lib/firebase.ts`
  messagingSenderId/appId. Then app: new `android/app/google-services.json`, `--dart-define API_BASE_URL=`.
  User must enable Google sign-in in the Firebase console and add the debug SHA-1. Old Firestore data cannot
  be exported while old billing is off (new DB starts empty). Parent calls also need Vobiz/Twilio creds.
- Local gcloud (`C:\Users\shree\google-cloud-sdk`) is half-installed (bundled `six` missing): works with
  `CLOUDSDK_PYTHON_SITEPACKAGES=1` for simple commands; YAML-heavy commands crash — use REST with
  `gcloud auth print-access-token`.

## 4. Done and verified (uncommitted)
- **Tools to the map** (shared widgets, all 15 tools), **VIDYA hands-free**, **floating orb off the tabs** —
  see git diff; unchanged since 3 Nov.
- **Scanner is LIGHT now** (user reversed the dark choice on 4 Nov): `assessment_scanner_screen.dart` +
  `widgets/page_capture.dart` use light tokens (`scanWell*`, `scanGuideInk`, `scanRuleInk`,
  `scanLineGlow` in `app_colors.dart`), warm `washScanner`; test pins `ToolScaffold.dark == false`.
- **Parent calling** (`lib/features/parent_hotline/`): screen rewritten to the map (Parent outreach →
  Step 1 Reason → Step 2 Evidence (real absences/marks; Draft waits for them) → Step 3 Review (green Call,
  WhatsApp) → Calling (timer, live transcript, "Leave — the call continues") → Summary in tinted cards).
  Busy guards, calling hours 9–21 IST, per-student reset, resume, honest unknown outcomes (Check again),
  translated errors (`hotline_copy.dart`; assistant wording only for the draft), `HotlineLaunch` route
  extra, attendance "N marked absent · call a parent" from SAVED absences. Fixed: footer `Center` covering
  the page; buttons dropping the app font (PrimaryButton now uses theme `labelLarge`).
- **Community** (`lib/features/staffroom/`, `inbox/`, `notifications/`): REST transports verified against
  `sargupta/sahayakai` routes/zod bodies; per-teacher Updates cleared on sign-out; re-mark-read on new
  messages; feed to the map (scrolling filter chips, two-initial tinted avatars via
  `shared/widgets/avatar_initials.dart`, compact like, real comment count, Connect chip); Messages (Decline +
  green Accept on the right, saffron unread badge, **"Just connected" + Message after Accept**); Your network
  (small Connect chips, subject line, "3,880 members").
- Tests: last full run 2219 pass; the only standing failures are the 2 pre-existing dark-contrast tests
  (`app_segmented_contrast_test (dark)`, `assessment_scanner_result_view_test … in dark`). Parent-call
  controller tests now pin the clock to 11:00 IST (they failed at night). Analyze clean, token guard PASS.

## 5. Prototype parity (5 Nov, done; uncommitted)
- Reopening the hotline with no student while a call the teacher left is still running returns to that
  call and resumes polling (`ParentHotlineController.init`); naming a student still does the server resume
  lookup.
- Home "Waiting for you" lists "Call with {name}'s parent · tap to return" while such a call runs
  (`vidya_home_screen.dart` `_WaitingCard`).
- Leaving a live call shows "The call carries on. You can return to it from Home."
- Updates call rows open that exact call: `HotlineLaunch.outreachId` → `ParentHotlineController
  .openOutreach` (running → calling + poll; finished → its summary; unreadable → "couldn't check" + Check
  again). "Start a new message" from such a call goes to the student list (no student to start over for).
- Deliberately NOT copied: the prototype used to record a call that ended while the teacher was away;
  the app stops polling when the teacher leaves (audit), so the outcome is seen and recorded on return.
  The prototype now behaves the same.
- 4 new strings in 11 languages (`communityJustConnected`, `communityConnectedCanChat`,
  `parentHotlineCallContinuesNote`, `homeWaitingParentCall`). Tests added in controller, notifications
  view, Home, hotline screen, network hub.

## 6. Not done / later
- In the app but not in the prototype: plan gate, signed-out, 429/422/503 call errors, privacy guard,
  summary transcript, group pages + group chat, connections with Disconnect, older messages, 11 languages.
- Backend doesn't support (don't fake): post comments, Shared resources library, end call / listen in,
  leave group (no DELETE verb in ApiClient).
- Startup screens and result/output screens to the map.

## 7. Environment notes
- Flutter: `export PATH="$HOME/fvm/versions/3.41.6/bin:$PATH"`. Run: `flutter run -d emulator-5554
  --no-enable-impeller`. Emulator: `C:\Android\emulator\emulator.exe -avd sahayak_emulator -no-snapshot-load
  -gpu auto`, then `adb emu avd hostmicon`. Its Pixel Launcher often stalls ("isn't responding") — tap Close.
- Strings: `python <scratchpad>/arb_append.py <module.py> lib/core/i18n/arb` (the old scratchpad was
  cleaned; the tool was recreated in `%TEMP%\claude\9711dfae764b4574\...\scratchpad\arb_append.py`; module
  format: `S = {}; add(key, desc, en, hi, bn, gu, kn, ml, mr, or_, pa, ta, te)`), then `flutter gen-l10n`. Section overlines (`MapOverline`) render Latin in CAPITALS —
  tests must match `.toUpperCase()`. Never `dart format` a folder; only edited files. Colours only from
  `lib/core/theme` (`bash scripts/token_guard.sh`). Light theme only; 12px floor; never invent counts.
