> **SUPERSEDED 2026-08-17 by docs/flutter/loop/LOOP_STATE.json and LOOP_RUNBOOK_V3.md. An audit on that date compared this file against the code and found specific false claims (see the $falseClaims list). It is kept, not deleted, so the forensic record survives and any future grep hit is obviously stale. DO NOT USE IT AS A SOURCE OF TRUTH.**
>
> - Its 'never push / never touch any remote' guardrail was already untrue — the branch was pushed and tracking origin.
> - Its brand-colour guardrail (#C2410C / #A8380A) matches nothing in the codebase; app_colors.dart ships #E0924D / #AC4815.
> - Its golden-test acceptance gate was never implemented.

---

# Autonomous Build Loop — SahayakAI Flutter (master runbook)

This runbook makes every loop wake deterministic. The outer loop (ScheduleWakeup dynamic mode)
advances the build unit-by-unit; each wake spawns inner subagents to build + verify one unit, then
reschedules. Goal: drive the ENTIRE app (foundation → P0 → P1 → P2 → release gates) to done,
unattended, with quality gated at every step. The user granted full permission/approval.

## Working dir & env
**Canonical build location (since the monorepo move):**
`/Users/sargupta/SahayakAIV2/wt-flutter-rebuild/sahayakai-flutter` — a **sparse git worktree** of the
SahayakAI monorepo (`/Users/sargupta/SahayakAIV2/sahayakai`) on branch **`feature/flutter-rebuild`**
(branched off `develop`, per the project git rules).

> History note: this app was first built in a throwaway nested repo at
> `sahayakai/sahayakai-flutter`. That was wrong — the monorepo already tracks that path. The app was
> moved onto `feature/flutter-rebuild` (commit 3e42b0906) and the nested repo removed; its full
> history is bundled at
> `<scratchpad>/sahayakai-flutter-nested.bundle`. Do NOT build in `sahayakai/sahayakai-flutter`
> (that path holds the superseded Phase T tree on other branches). Never touch the main working tree
> — it carries unrelated uncommitted work.

Every shell step:
```
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$PATH"
```

## Source-of-truth docs (read the relevant one per unit — do not re-derive)
- `docs/flutter/FLUTTER_BUILD_PLAN.md` — master plan: foundation checklist F1–F12, ordered screen queue P0→P2, per-unit/per-phase verification, guardrails.
- `docs/flutter/BUILD_STATE.json` — the live tracker (currentPhase, foundation[], screens[], verification, guardrails). THE authority on "what's next".
- `docs/flutter/SCREEN_INVENTORY.md` — every screen's endpoint + request/response JSON + form fields + enums.
- `docs/flutter/THEME_SPEC.md` — theme (note: brand override in effect → primary is **#FF9933** light / **#FFAB57** dark, not the doc's #E0924D).
- `docs/flutter/ARCHITECTURE.md` — Riverpod/go_router/dio/auth/i18n patterns, folder structure, shared shells.
- `docs/flutter/DESIGN_RUBRIC.md` — §12 is the 15-point pre-merge screen checklist. EVERY screen must pass it.

---

## OUTER LOOP — do this every wake

1. **Read** `docs/flutter/BUILD_STATE.json`. Identify the next actionable unit (see "Unit types").
2. **Foundation guard.** If foundation is not fully complete (`currentPhase` still `foundation`, or any foundation task not `done`, or last known `flutter analyze` not clean):
   - Run `cd sahayakai-flutter && flutter analyze 2>&1 | tail -3` and check recent `git log --oneline` to see if the background foundation builder has finished/committed.
   - If foundation is still incomplete/in-progress → **do NOT start screens**. Either finish the specific missing foundation item yourself (if the builder errored out) or, if a build clearly appears still in progress and nothing is broken, just `ScheduleWakeup` again (~300s) and end the wake. Never build a screen on an unproven foundation.
   - Only advance to screens once foundation is `done` AND `flutter analyze` is clean.
3. **Execute the unit** per its type below (spawn inner subagents SYNCHRONOUSLY — `run_in_background:false` — so the wake owns the unit start-to-finish and two builds never overlap).
4. **Verify** the unit's acceptance gate (see Quality gates). If it fails, fix (another synchronous subagent pass) until it passes. A unit does not advance until green.
5. **Commit** on `feature/flutter-rebuild`: stage EXPLICIT paths (never `git add -A`/`.`), conventional message (`feat(<feature>): …` / `chore(foundation): …`), NO Claude attribution.
6. **Update** `docs/flutter/BUILD_STATE.json`: mark the unit `done` (+ commit hash + notes), advance `currentPhase`/pointer.
7. **Reschedule or stop.** If more actionable (non-handoff-blocked) units remain → `ScheduleWakeup` (same prompt, delay 240–300s, reason = next unit). If everything actionable is done (only handoff-blocked or P2-optional remains, or all P0+P1 shipped and release gate green) → `ScheduleWakeup stop:true` and post a final summary.

---

## Unit types

### A. Foundation task (F1–F12)
Build per `FLUTTER_BUILD_PLAN.md §2` + `ARCHITECTURE.md`. (The background builder handles the first pass; the loop only touches these if an item is missing/broken.) Gate: `flutter analyze` clean, `dart run build_runner build` clean, `flutter gen-l10n` clean.

### B. Screen (P0.x / P1.x / P2.x) — the core inner loop
For the next `pending` screen in `BUILD_STATE.json.screens` (strict queue order):
1. **BUILD subagent** (general-purpose, synchronous): implement the screen per `SCREEN_INVENTORY.md` (exact endpoint, request DTO, response DTO, form fields, enums) using the locked patterns — `ToolScaffold` + form + `ResultView` off a `@riverpod` AsyncNotifier; DTOs `json_serializable`; repository → domain model; dio via the auth interceptor. Wire the route into `app_router.dart` and (if a tool) the dashboard tile grid + Create palette. Respect ALL design requirements below. Run `dart run build_runner build --delete-conflicting-outputs` + `flutter analyze` and self-fix to zero errors.
2. **DESIGN-REVIEW subagent** (general-purpose, synchronous — the adversarial inner check): give it ONLY `DESIGN_RUBRIC.md §12` + the new screen files; it returns PASS or a specific FAIL list (grid/touch/type/Indic/color/contrast/cards/states/360dp/scale/wrap/safe-area/dark/motion/no-slop-no-emoji-not-Hindi-only). It must confirm: primary is #FF9933; cards `surfaceTintColor: transparent`; every state covered (loading skeleton / empty / error+retry / offline); no emoji; Lucide icons; Indic line-height ≥1.4; ≥48dp touch targets; no RenderFlex overflow at 360dp & textScale 1.3.
3. **If FAIL** → a FIX subagent addresses each point; re-run step 2. Loop until PASS (cap 3 rounds; if still failing, record the residual in BUILD_STATE notes and flag it — do not silently pass).
4. Gate met = analyze clean + rubric PASS. Commit. Advance.

> Handoff-aware: screens needing live Firebase auth/data can be built against the stub auth/token providers with a clear runtime TODO; mark them `built-pending-firebase` in BUILD_STATE (UI done, live wiring waits on the google-services.json handoff). Do NOT stop the loop for this — keep building unblocked screens.

### C. Verification / release gate
At the end of each priority band (end of P0, end of P1): run `flutter gen-l10n`, `flutter analyze` (zero), `flutter build apk --debug` (green), and a full `DESIGN_RUBRIC §12` sweep across shipped screens. Record results. `flutter build apk --release` needs signing (reuse the Capacitor keystore approach or generate one; gitignored) — do at end of P1. App Check / live auth verification is handoff-gated → note, don't block.

---

## Design & product requirements (enforced on EVERY screen)
- **Brand (accessible saffron split — founder-approved):** ALWAYS use `Theme.of(context).colorScheme.primary` for saffron, NEVER a raw hex. The theme resolves it to accessible **#C2410C** (light, AA-pass) / vivid **#FFAB57** (dark). Vivid #FF9933 = `AppColors.brandSaffron`, ONLY for large brand moments, NEVER behind small text on light (fails AA). Saffron is an ACCENT (CTA/active/focus), never a surface flood; AppBar surface-colored. Secondary green #28572B, tertiary navy #000080. Contrast is locked by test/core/theme/theme_contrast_test.dart — keep it green.
- **No emojis** anywhere — Lucide icons only. **No em dashes** in user copy.
- **All 11 languages first-class**, never Hindi-only. Language switch flips BOTH UI locale AND the AI `language` param via the single `AppLocale`. Indic text line-height ≥1.4 (≥1.7 for AI output blocks); no clipped matras.
- **Teacher dignity** in all copy — no aggressive marketing jargon.
- **Touch targets ≥48dp.** Reusable shells only (`ToolScaffold`, `ResultView`, `AppCard`) — screens never invent their own page/layout grammar (this is the anti-Phase-T rule).
- **Every screen covers all states:** loading (shimmer skeleton), empty, error+retry, offline. AI calls up to 120s → skeleton loader, handle 401/403 PLAN_UPGRADE_REQUIRED/429 USAGE|DAILY_LIMIT/503+Retry-After/400 distinctly.
- Client NEVER sends `x-user-*` or `userId`/PII the server injects/strips (see SCREEN_INVENTORY per-endpoint notes).

## Quality gates (a unit is not "done" until ALL pass)
0. **Tests are kept, never deleted.** Every screen ships a permanent test file at
   `test/features/<feature>/<feature>_test.dart` covering: request JSON shape, null/empty response
   handling, unknown-enum tolerance, and overflow gates (360dp x textScale 1.3 x light/dark).
   `flutter test` must be green. Do NOT delete a scratch test harness to satisfy a "clean git status"
   requirement — commit it instead.
1. `dart run build_runner build --delete-conflicting-outputs` — clean.
2. `flutter analyze` — ZERO errors.
3. `flutter gen-l10n` — all 11 ARBs compile, no missing keys (when i18n strings changed).
4. Screen: `DESIGN_RUBRIC.md §12` PASS (via the review subagent).
5. Token-guard grep (once foundation adds it): no off-token color/spacing/radius, no emoji, no banned curves.

## Guardrails (hard)
- Never `git push` / never touch any remote.
- Never touch `sahayakai-main` or any sibling repo — this app is read-only over that backend; no backend edits.
- Never publish (no deploy, no store upload).
- Commit each unit on `feature/flutter-rebuild`; stage explicit paths; no Claude attribution; no `git add -A`.
- If the Android SDK needs interactive license acceptance, or a build needs Firebase config that isn't present in a way that blocks ALL progress → record it in `docs/flutter/HANDOFF.md` and continue with unblocked work; only `stop` the loop when nothing actionable remains.

## STOP conditions (call ScheduleWakeup stop:true + final summary)
- All P0 + P1 screens `done` (or `built-pending-firebase`) AND the P1 release gate is green (analyze clean, debug+release apk build green), OR
- Only handoff-blocked / P2-optional units remain.
Final summary must list: shipped screens, analyze/build status, APK/AAB paths, any `built-pending-firebase` items, and the handoff checklist (Firebase console: google-services.json, SHA fingerprints, App Check).

## Reporting
Each wake, keep the response short: which unit ran, gate result (analyze + rubric), commit hash, what's next. The user is watching; be truthful about failures — a red gate is reported, never hidden.
