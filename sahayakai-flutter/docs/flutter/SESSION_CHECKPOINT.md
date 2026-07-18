# SESSION CHECKPOINT — SahayakAI Flutter app (2026-07-18)

Durable handoff so work continues seamlessly after context compaction. Read this + memory
`project_android_app.md` first.

## WHERE (locations, branch, env)
- **Canonical build location:** `/Users/sargupta/SahayakAIV2/wt-flutter-rebuild/sahayakai-flutter`
  — a SPARSE GIT WORKTREE of the monorepo `/Users/sargupta/SahayakAIV2/sahayakai`, branch
  **`feature/flutter-rebuild`** (off `develop`). Commit here.
- **NEVER touch:** `sahayakai/sahayakai-flutter` (superseded Phase T on other branches), the monorepo
  MAIN working tree (has ~26 unrelated uncommitted files), `wt-profile-security`, `sahayakai-main`
  (READ-ONLY reference for backend contracts only).
- **Env for every shell step:** `export ANDROID_HOME="$HOME/Library/Android/sdk";
  export JAVA_HOME="/opt/homebrew/opt/openjdk@17"; export PATH="$JAVA_HOME/bin:$PATH"`
- Guardrails: never push/deploy; explicit-path commits (NEVER `git add -A`); NO Claude attribution;
  author already configured.

## STATUS (green baseline)
- **889 tests green · `flutter analyze` zero · `bash scripts/token_guard.sh` PASS ·
  `flutter build apk --debug` builds (~175 MB, com.sargvision.sahayakai).**
- Two Android tracks: **Capacitor** (parked, signed `.aab` done, in sibling `sahayakai-android/`) and
  **Flutter** (PRIMARY, this repo).
- Done so far on Flutter:
  1. **Functional app** — P0+P1, 16 screens (8 AI tools + auth/settings/profile/library/palette),
     Firebase deferred/stubbed (`tokenProvider` returns null → authed routes 401 at runtime).
  2. **Premium re-skin "Ledger — Ivory & Ink" (U0–U11 DONE)** — ivory paper, Fraunces serif + Inter
     with Noto dual Indic fallback, warm two-layer shadows, saffron-as-wax-seal (<10%), DocumentSheet
     result artifacts, ScoreRing, floating nav, native SahayakAI icon+splash. Spec:
     `docs/flutter/design/PREMIUM_DESIGN_SPEC.md`. Accessible saffron split: light fill `#C2410C`/text
     `#A8380A`, dark `#F6A959`, `brandSaffron #FF9933` large-decorative only — locked by
     `test/core/theme/theme_contrast_test.dart` (keep green).
  3. **Voice-first pillar U-V1..U-V5 DONE + rendered on device** — voice stack (record ^6.2.1 /
     just_audio / permission_handler / audio_session, injectable services in `lib/shared/voice/`),
     STT/VIDYA/TTS/session/profile repos (`lib/features/vidya/data/`), VidyaController state machine,
     128dp Seal Mic (5 states), and the **"Almanac Speaks" voice home** (`lib/features/vidya/
     presentation/vidya_home_screen.dart`) that REPLACES the form-first home. Home route = VidyaHome
     (nav icon = mic); old tool grid moved to `/prep-desk` (top-right grid action + Create palette).

## NEXT PLAN — 20 pending pillar units (in order), per docs/flutter/pillars/PILLAR_BUILD_PLAN.md + PILLAR_BUILD_STATE.json
Founder GREEN-LIT building ALL remaining pillars, voice-first, in the Ledger design. Resume the
autonomous loop (below). Order:
- **U-V6** — thread voice INTO tools: the `NAVIGATE_AND_FILL` directive → open the right tool prefilled
  + an inline field mic. (NEXT UP.)
- **U-V7** — VIDYA persistence (Firestore session restore, turn sync) + VIDYA reachable on every screen.
- **Block B — Parent hotline (pillar 03):** U-PH1 data/domain → U-PH2 HotlineStage controller + poll →
  U-PH3 pick→reason→compose→review → U-PH4 honest "calling" waiting state → U-PH5 summary DocumentSheet.
- **Block C — Staffroom + Pro inbox (04/05), Firebase-gated:** U-SI0 transport spike (Firebase SDK live
  reads + REST — BLOCKS the block) → U-SI1 Pro Inbox realtime core → U-SI2 Staffroom home/feed →
  U-SI3 staffroom chat + persona-pulse → U-SI4 directory/profile/connection DM-gate → U-SI5
  notifications → U-SI6 presence (RTDB) + FCM.
- **Block D — Prep-desk tail + OS hub:** U-PD1 Visual Aid, U-PD2 Content Creator, U-PD3 Video
  Storyteller, U-PD4 Virtual Field Trip, U-PD5 Assessment Scanner (multipart + ScoreRing); U-OS1 Me/OS hub.

## HOW TO RESUME (the loop)
Re-arm the ScheduleWakeup PILLAR loop (the standard prompt used all session). Each wake:
1. Guard: `flutter analyze` clean + `flutter test` green (889 baseline, growing) + worktree clean.
2. Take the next pending unit from PILLAR_BUILD_STATE.json.
3. Inner loop SYNCHRONOUSLY: a BUILD subagent (implement per PILLAR_BUILD_PLAN + the unit's SPEC_*.md,
   REUSE the Ledger widgets + voice stack; VERIFY backend contracts READ-ONLY in sahayakai-main) then
   an adversarial DESIGN-REVIEW subagent vs PREMIUM_DESIGN_SPEC §7; FIX until PASS (cap 3). Commit each
   unit SEPARATELY.
4. Gate: build_runner clean + analyze ZERO + test ALL green (never weaken/delete behaviour tests;
   update only widget-STRUCTURE expectations and SAY SO) + token_guard PASS + design-review PASS +
   **`flutter build apk --debug` (or `bash scripts/verify_build.sh`) for ANY unit touching
   pubspec/android/plugin/manifest** (analyze+test do NOT run Gradle — the record federation bug proved
   this). Update PILLAR_BUILD_STATE.json + commit.
5. Reschedule for the next unit. At end of each Block run the APK build. When ALL units done → pillar
   release gate (gen-l10n + analyze + test + token_guard + apk build) → stop + final summary.

Firebase-gated units (Block C, live voice/calls): build UI + stack + plumbing + UNIT TESTS, degrade to
signed-out EmptyView / feature-flags-off, verify by code+test NOT live, SAY SO. The main loop
(interactive) screenshots renderable screens on the emulator between wakes.

## EMULATOR (for on-device verification)
- AVD `Pixel_7`. Headless boot:
  `nohup "$ANDROID_HOME/emulator/emulator" -avd Pixel_7 -no-window -gpu swiftshader_indirect -no-boot-anim -no-snapshot-save -netdelay none -netspeed full &`
  then `adb wait-for-device` + poll `getprop sys.boot_completed`.
- Storage is TIGHT: `adb uninstall com.sargvision.sahayakai` before `adb install`.
- Navigate to voice home: launch → tap Continue (~540,1880) → skip onboarding (~926,211) → VIDYA home
  (mic). Top-right grid (~845,210) → prep-desk tools. Screenshot: `adb exec-out screencap -p > x.png`.
- Voice tap → 401 on the stub (no live STT/VIDYA/TTS until Firebase). The screen + states RENDER.

## OPEN ITEMS / HANDOFFS (founder actions — NOT automatable)
- **Firebase** (turns everything live): `flutterfire configure --project=sahayakai-b4248`, add
  firebase_*/google_sign_in, google-services.json, register SHA-1/256, Play Integrity App Check. Until
  then every authed route (tools' generation, voice, calls, staffroom) 401s. Full checklist:
  `docs/flutter/HANDOFF.md`.
- **i18n translation gap**: the many new premium + pillar UI strings are in all 11 ARBs but as ENGLISH
  placeholders for the 10 Indic languages — needs native review (founder decision still open).
- **Backend security fix** on branch `fix/profile-plan-escalation` (POST /api/user/profile plan
  self-grant + paying-user downgrade) awaits founder review. Chips filed: settings-profile-read 405,
  organizationId client-editable, token-budget-429-misclassification.
- **Play Console** publish is founder-only (account + prohibited action).
- **Mobile-app preview artifact** (device mockups, logo fixed):
  https://claude.ai/code/artifact/9a358675-6635-4ded-9413-5c4abc4a602b
