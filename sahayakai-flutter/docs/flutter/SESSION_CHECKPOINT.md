# SESSION CHECKPOINT — SahayakAI Flutter app (2026-07-20)

Durable resume doc. Read this + memory `project_android_app.md` + `reference_production_brand_palette.md`.

## WHERE
- **Canonical build location:** `/Users/sargupta/SahayakAIV2/wt-flutter-rebuild/sahayakai-flutter` — sparse git worktree of the monorepo, branch **`feature/flutter-rebuild`** (113+ commits off `develop`). Commit here only.
- **NEVER touch:** `sahayakai/sahayakai-flutter`, the monorepo MAIN working tree, `wt-profile-security`, `sahayakai-main` (READ-ONLY backend reference).
- Env per shell: `export ANDROID_HOME="$HOME/Library/Android/sdk"; export JAVA_HOME="/opt/homebrew/opt/openjdk@17"; export PATH="$JAVA_HOME/bin:$PATH"`.
- Guardrails: never push/deploy; explicit-path commits (never `git add -A`); no Claude attribution; never add firebase native deps (breaks the APK without google-services.json).

## STATUS (committed = always green)
- **22 of 25 units DONE. 1484 tests green · analyze 0 · token_guard PASS · `flutter build apk --debug` 176 MB · ZERO firebase packages.**
- **Brand = PRODUCTION palette, sampled live from sahayakai.com** (commit 6342f95ac): saffron #E0924D/#EB9447 (the globals.css `/* #FF9933 */` comment is WRONG — production renders the HSL), saffron-text #AC4815, green #28572B, navy #000080, bg #F9F7F3, ink #0F1729, Outfit headings. app_colors.dart is the token source.
- Shared AA hardening (app-wide, via adversarial design reviews): AppBadge accent+neutral, PlanBadgeChip, EmptyView body full-ink, errorContainer warm-branded, AppSegmented unselected label. Muted-on-ground RESOLVED to full-ink onSurface (muted only on white cards; token unchanged; sweep chip filed).
- **Pillars DONE:** 02 Voice/VIDYA (U-V1..7) · 03 Parent Hotline (U-PH1..5) · 01 Prep Desk complete (U-PD1 Visual Aid c3cf2f62e, U-PD3 Video Storyteller f39e7ed60, U-PD4 Virtual Field Trip c9e9af016, U-PD2 Content-Creator HUB 609ec04a3 [a hub — /api/ai/content does NOT exist], U-PD5 Assessment Scanner c6c36b42b) · 06 Me/OS hub (U-OS1 d6a695c53).
- **Block C (04 Staffroom + 05 Pro Inbox), Firebase-walled, 4 of 7 done:** U-SI0 transport seam cc861dbc1 (DTOs + InboxTransport/StaffroomTransport/NotificationsTransport/PresenceTransport interfaces + Deferred impls emitting awaitingFirebase→EmptyView + typed TransportUnavailable writes; fakes in test/support/fake_block_c_transports.dart; NO firebase imports) · U-SI1 Pro Inbox b00e25f70 (list/thread/bubbles/optimistic send/unread badge; entry in voice-home app bar) · U-SI2 Staffroom+Network hub ca5f4ecd6 (unified feed, optimistic likes, group detail+join, Network hub = AppSegmented [Staffroom|Messages] via a 'network' app-bar entry) · U-SI3 chat+persona-pulse e2b43dee0 (multi-author staff-room+group chat, honest 'AI teacher'-labelled persona bubbles, leak-free 3-min pulse timer: cancel-on-dispose, 503-stops-permanently).
- Backend truth (verified): Block-C writes = Next SERVER ACTIONS (no REST routes exist except persona-pulse/teacher-activity/feedback); realtime reads = Firestore onSnapshot. Everything Block C is verified by code+test via the fakes, NOT live; on-device it renders sign-in/empty states. DM-gate rule: messaging requires a MUTUAL connection (FollowEdge ≠ MutualConnection).

## INTERRUPTED — U-SI4 (directory + profile + connection DM-gate), ~70% built
- The build agent (id `ae51207cfe89bfa4b`) was killed by the **WEEKLY usage limit (resets Jul 21 ~6:30pm IST)** mid-way through adding the 10 Indic ARB translations.
- Its partial work is **stashed**: `git stash list` → **`stash@{0}: u-si4-partial-weekly-limit`** (connection_providers.dart, teacher_directory_screen.dart, teacher_profile_screen.dart, connection_button.dart, directory_teacher_row.dart, follow_button.dart, router wiring, partial ARBs). It does NOT compile yet (~114 analyze issues: missing build_runner codegen + gen-l10n for the partial keys). **`stash@{1}` belongs to ANOTHER session (wip-intent-route-400-guard) — NEVER touch it.**

## HOW TO RESUME (after the limit resets, Jul 21 ~6:30pm IST)
1. `git stash pop stash@{0}` in the worktree (restores the U-SI4 partials).
2. SendMessage the U-SI4 agent `ae51207cfe89bfa4b`: finish the 10 Indic ARBs, run build_runner + gen-l10n, fix analyze to 0, complete tests (esp. DM-GATE proofs: Message ONLY for a mutual connection; follow-only canNOT message; optimistic rollback), gates green (baseline 1484), do NOT commit. If the resume yields no work, re-dispatch a fresh BUILD subagent with the U-SI4 brief.
3. Main loop verifies (analyze/test/token_guard/no-firebase) → adversarial DESIGN-REVIEW (DM-gate correctness #1) → fix cap 3 → commit → state JSON → then **U-SI5 notifications** (NotificationsTransport; the Network hub's third surface) → **U-SI6 presence+FCM** (the handoff-walled one — keep the APK green, defer native deps) → **PILLAR RELEASE GATE** (gen-l10n + analyze + test + token_guard + apk build) → final summary + update this file.
- The loop pattern per unit: guard → BUILD subagent → verify → DESIGN-REVIEW subagent → fix (cap 3) → commit (explicit paths) → PILLAR_BUILD_STATE.json → ScheduleWakeup next.

## OPEN ITEMS (founder)
- **FIREBASE HANDOFF (the big unlock — docs/flutter/HANDOFF.md):** flutterfire configure + google-services.json + real auth into tokenProvider + implement the Firestore/RTDB/FCM transport impls behind the U-SI0 interfaces + the backend thin-REST-wrapper task over the server actions. Until then: tools/voice/calls 401; staffroom/inbox render sign-in states.
- i18n: all pillar UI strings are REAL Indic translations x11 (interim-LLM) — native review pending.
- Filed chips: ToolScaffold footer slot · AppSkeleton reduce-motion · ground-caption sweep · _ConfirmChip 48dp.
- Play Console publish = founder-only.
- Emulator: AVD Pixel_7; `adb uninstall com.sargvision.sahayakai` before install if storage-tight; nav: Continue (540,1880) → Skip (929,210) → voice home; app-bar right actions ≈ network/messages/grid.
