# SahayakAI Flutter — MASTER BUILD PLAN

**Status:** authoritative build plan (v1)
**Last updated:** 2026-07-17
**Synthesized from:** `THEME_SPEC.md`, `SCREEN_INVENTORY.md`, `ARCHITECTURE.md`, `DESIGN_RUBRIC.md` (all in this directory)
**Toolchain:** Flutter 3.41.6 / Dart 3.11.4 (`sdk: ^3.11.4`)
**Backend:** existing production `https://sahayakai.com` — **NO backend rewrite**.
**Autonomous loop:** driven by `BUILD_STATE.json` (same directory). Read it, do the current phase's next `pending` unit, mark it, commit, repeat.

---

## 1. Executive summary (1 page)

**What it is.** A fresh, native Flutter (Material 3) Android client for SahayakAI — an AI teaching assistant for Indian schoolteachers. It is a thin native front-end over the unchanged Next.js production backend. The predecessor app died on layout/design fidelity; this rebuild is engineered so screens are *assembled from a locked design system and reusable shells*, not hand-invented. Every design value is pinned (`DESIGN_RUBRIC.md`), every backend contract is pinned (`SCREEN_INVENTORY.md`), every architectural boundary is pinned (`ARCHITECTURE.md`).

**Architecture in one breath.** Feature-first `lib/` layout. State = **Riverpod** (code-gen, `riverpod_generator`); every AI tool is one `AsyncNotifier` exposing `AsyncValue<T?>` (idle=null, loading, error, data). Navigation = **go_router** with a single top-level `redirect` auth guard bridged to the Firebase auth-state stream. Networking = one **dio** instance with a `QueuedInterceptor` that attaches `Authorization: Bearer <Firebase ID token>` (+ best-effort `X-Firebase-AppCheck`) and does one forced-refresh retry on 401. A centralized error mapper turns `DioException` into a typed `ApiException` (network/timeout/401/403/429/5xx). Auth = `firebase_auth` + `google_sign_in` (native `signInWithCredential`, no redirect) + **App Check Play Integrity**. i18n = **flutter gen-l10n** (ARB) across 11 Indic languages, with a single `AppLocale` enum that is the source of truth for BOTH the UI locale AND the `language` (full English name) param every AI endpoint expects — one switcher, two consumers, zero drift. Noto script fonts are **bundled as assets** (rural = offline; no network font fetch).

**The layout-failure insurance.** Two reusable widgets standardize every tool page so no screen invents its own broken layout: `ToolScaffold` (page shell: appbar + scrolling form capped at 640dp + sticky Generate button) and `ResultView<T>` (the `AsyncValue` state machine → skeleton / empty / error+retry / data). All design tokens live once in `lib/core/theme/` (colors, radius, spacing, shadows, motion, text). A CI grep / `custom_lint` pass rejects off-token values (`Color(0x…)` outside theme, off-grid `EdgeInsets`, off-scale radius, emoji, non-sanctioned curves, runtime GoogleFonts fetch).

**Key backend facts the client honors.** Canonical host `www.sahayakai.com`; all AI calls are POST JSON, wrapped in `withPlanCheck`, auth-required, up to 120s (`maxDuration`). Client NEVER sends `x-user-*` headers (middleware strips + injects them from the verified token). Standard non-200s: 401 (re-auth), 403 `PLAN_UPGRADE_REQUIRED`, 429 `USAGE_LIMIT_REACHED`/`DAILY_LIMIT_REACHED`, 503 + `Retry-After`, 400 (rephrase). Firebase project `sahayakai-b4248`.

**Critical design decision (do not "fix").** Web `--primary: 28 70% 59%` renders as **`#E0924D`** (muted saffron), NOT the `#FF9933` the CSS comment claims. `THEME_SPEC.md` §0 mandates the token-accurate `#E0924D` for pixel parity with live web. (Note: `DESIGN_RUBRIC.md` §0 lists `#FF9933` — **THEME_SPEC wins** for the actual `ColorScheme`, since it is derived from computed pixels; the rubric's other tokens/rules stand.) Dark primary = `#EB9447`. Saffron is an **accent** (CTA/active/focus), never a surface flood; AppBar is surface-colored, not saffron.

---

## 2. FOUNDATION checklist (BUILD FIRST — before any screen)

Do these in order. Each is a commit unit on `develop`. Nothing in the screen queue may start until F1–F12 are green and `flutter analyze` is clean.

- [ ] **F1 — Project scaffold.** `flutter create` with `org` set; set `name: sahayakai`, `publish_to: none`, `version: 1.0.0+1`, `environment: sdk: ^3.11.4` in `pubspec.yaml`. Android `minSdk` per Play Integrity requirement, `compileSdk` current.
- [ ] **F2 — pubspec deps.** Add the exact dependency list from `ARCHITECTURE.md` §11: runtime — `flutter_riverpod ^2.6.1`, `riverpod_annotation ^2.6.1`, `go_router ^14.6.2`, `dio ^5.7.0`, `firebase_core ^3.8.0`, `firebase_auth ^5.3.4`, `firebase_app_check ^0.3.2+4`, `google_sign_in ^6.2.2`, `json_annotation ^4.9.0`, `shared_preferences ^2.3.3`, `shimmer ^3.0.0`, `cached_network_image ^3.4.1`, `intl ^0.19.0`, `image_picker ^1.1.2`, `file_picker ^8.1.6`, `sentry_flutter ^8.12.0`, `lucide_icons` (icon parity), `flutter_localizations` (sdk). dev — `build_runner ^2.4.13`, `riverpod_generator ^2.6.3`, `go_router_builder ^2.7.1`, `json_serializable ^6.9.0`, `custom_lint ^0.7.0`, `riverpod_lint ^2.6.3`, `flutter_lints ^6.0.0`. `flutter pub get` resolves clean (bump to nearest patch on conflict; never downgrade `firebase_*` majors).
- [ ] **F3 — Bundle fonts.** Drop Outfit (400/500/600/700/800), Inter (300/400/500/600/700), and all 9 Noto Sans script `.ttf`s into `assets/fonts/`; register every family + weight in `pubspec.yaml` `flutter.fonts` (per `ARCHITECTURE.md` §11). No runtime GoogleFonts network fetch (rural/offline).
- [ ] **F4 — Theme layer.** Create `lib/core/theme/`: `app_colors.dart`, `app_radius.dart`, `app_spacing.dart`, `app_shadows.dart`, `app_motion.dart`, `app_text.dart`, `app_theme.dart`. Port `THEME_SPEC.md` §7 verbatim (light+dark `ColorScheme`, `surfaceTintColor: transparent` on cards/menus, `scaffoldBackgroundColor = surfaceContainerLowest`, buttons ≥48dp radius 10, cards radius 12, every `TextStyle.height ≥ 1.4`, `kIndicFallback` + `warmIndicFonts()`, `AppTheme.withIndic` for Indic line-heights). Constants: colors `#E0924D`/`#EB9447`; radius sm8/md10/lg12/xl16/hero20/pill; spacing 4/8/12/16/20/24/32/40/48/64/80/96/128; motion micro150/small250/medium350 + `easeOutQuart Cubic(0.16,1,0.3,1)`.
- [ ] **F5 — i18n scaffold.** `l10n.yaml` (arb-dir `lib/core/i18n/arb`, template `app_en.arb`, class `AppLocalizations`, `nullable-getter: false`); `flutter.generate: true`. Create `app_en.arb` + 10 stub ARBs (hi, bn, kn, ta, te, mr, gu, pa, ml, or). `AppLocale` enum (`lib/core/i18n/app_locale.dart`) = source of truth (`code`, `aiName`, `nativeLabel`). `locale_provider.dart` (Riverpod, persisted via `shared_preferences`). Wire `supportedLocales`/`localizationsDelegates`/`locale` on `MaterialApp.router`. `flutter gen-l10n` succeeds.
- [ ] **F6 — Firebase + App Check.** `flutterfire configure --project=sahayakai-b4248` → `lib/firebase_options.dart` + `android/app/google-services.json` + SHA-1/SHA-256 registered (**HANDOFF: needs SARGVISION Firebase console**). `bootstrap()` in `main.dart`: `Firebase.initializeApp`, `FirebaseAppCheck.activate` (debug provider in `kDebugMode`, `playIntegrity` release), `runApp(ProviderScope(...))`.
- [ ] **F7 — Auth layer.** `lib/core/auth/`: `auth_providers.dart` (`firebaseAuth`, `authState` stream, `isSignedIn`), `auth_repository.dart` (`signInWithGoogle` via `google_sign_in`+`signInWithCredential`, `signOut`). Per `ARCHITECTURE.md` §2, §5.
- [ ] **F8 — dio + auth interceptor.** `lib/core/network/`: `dio_config.dart` (base `https://sahayakai.com`, connect 15s / receive 125s / send 60s), `auth_interceptor.dart` (`QueuedInterceptor`: Bearer token + best-effort App Check header + one forced-refresh 401 retry), `api_client.dart` (`post`/`get` with decode fn), `api_exception.dart` (typed `ApiErrorKind` mapper). Per `ARCHITECTURE.md` §4.
- [ ] **F9 — Router.** `lib/core/router/`: `routes.dart` (path constants + `publicPaths = {splash, login, tryCall}`), `app_router.dart` (`GoRouter` + `_AuthRefresh` bridge + `redirect` guard). Typed routes via `go_router_builder`. Per `ARCHITECTURE.md` §3.
- [ ] **F10 — Shared shells.** `lib/shared/widgets/`: `tool_scaffold.dart`, `result_view.dart` (the `AsyncValue` state machine), `app_skeleton.dart` (shimmer), `error_view.dart`, `empty_view.dart`, `offline_view.dart`, `primary_button.dart` (≥56dp CTA), `app_card.dart` (single card grammar: radius 12, `shadowSoft`, 1dp border, `space4` padding), `language_switcher.dart`. Per `ARCHITECTURE.md` §9 + `DESIGN_RUBRIC.md` §5–6, §14.
- [ ] **F11 — App root + bottom nav.** `app.dart` (`SahayakApp`: `MaterialApp.router` + theme + darkTheme + l10n + locale watch). `AppShell` with Material 3 `NavigationBar` (4 tabs: Home / Create(action) / Library / Me — Lucide `Home`/`Sparkles`/`Library`/`User`, 56dp, transparent indicator, saffron active, 10sp labels; per `THEME_SPEC.md` §5.5).
- [ ] **F12 — Codegen + lint gate.** `dart run build_runner build --delete-conflicting-outputs` clean; `flutter analyze` zero issues; add the CI grep / `custom_lint` token-guard (reject `Color(0x` outside `lib/core/theme/`, off-grid spacing, off-scale radius `.circular(` != {8,10,12,16,20}, emoji codepoints, `Curves.` != sanctioned, runtime `GoogleFonts` fetch). Per `DESIGN_RUBRIC.md` §14.

**Foundation exit criteria:** app boots to Splash → (unauth) Login → sign-in → Dashboard shell with working bottom nav, themed light+dark, no analyzer errors, token-guard passing.

---

## 3. SCREEN BUILD QUEUE (ordered P0 → P2)

Build strictly top-to-bottom. Each screen is one or more commit units on `develop`. **Acceptance = passes the `DESIGN_RUBRIC.md` §12 15-point pre-merge checklist** (Grid, Touch, Type, Indic, Color, Contrast, Cards, States, 360dp, Scale, Wrap, Safe-area, Dark, Motion, No-slop/no-emoji/not-Hindi-only) AND the screen-specific criteria below AND `flutter analyze` clean.

Feature-first path convention: `lib/features/<feature>/{data,domain,presentation}/…`. Every AI screen = `ToolScaffold` + form + `ResultView` off a `@riverpod` controller; DTOs are `json_serializable`; repository returns domain model.

### P0 — Core loop (auth shell + top 4 teacher tools)

**P0.1 — Splash**
- File: `lib/features/splash/presentation/splash_screen.dart`
- Endpoint: none (`FirebaseAuth.currentUser` + silent token refresh)
- Accept: brand mark on `background`; resolves App Check + first auth snapshot then router redirects (parks on `/splash` while `authState` loading); no bare full-screen spinner as the only state; SafeArea + status-bar style correct; §12 checklist.

**P0.2 — Login / Onboarding (Google)**
- File: `lib/features/onboarding/presentation/login_screen.dart` (+ `onboarding_screen.dart`, `profile_form.dart`)
- Endpoint: client Firebase Google sign-in (no REST); profile save → `updateProfileAction` / profile API → Firestore `users/<uid>`
- Fields: displayName, schoolName, educationBoard (EDUCATION_BOARDS), boardCategory, state (INDIAN_STATES), district, subjects[] (SUBJECTS), gradeLevels[] (GRADE_LEVELS), preferredLanguage (LANGUAGES), administrativeRole?, phoneNumber, pincode
- Accept: Google sign-in works native (no redirect); onboarding NOT hard-gated (`ONBOARDING_GATE_ENABLED` off — reachable but skippable); language picker step 0; enums hardcoded exactly per `SCREEN_INVENTORY.md` §0; multi-select uses chips ≥48dp; §12 checklist (esp. no centered-hero slop, not Hindi-only).

**P0.3 — Dashboard Home**
- File: `lib/features/dashboard/presentation/dashboard_screen.dart`
- Endpoint: none dedicated (reads profile `users/<uid>` + recent library list)
- Accept: greeting + real tool-tile grid deep-linking to tool routes + recent items; hosts 4-tab bottom nav; real content density (no 3-equal-placeholder-cards filler); left-aligned; loading/empty/error states for the recent list; §12 checklist.

**P0.4 — Lesson Plan Generator ★ flagship**
- File: `lib/features/lesson_planner/presentation/lesson_plan_screen.dart`
- Endpoint: `POST /api/ai/lesson-plan`
- Form: topic (required, max 1000) · gradeLevels[] · subject · language · resourceLevel (segmented low/med/high) · difficultyLevel (segmented remedial/standard/advanced) · useRuralContext (toggle). Do NOT send userId/state/district (server injects).
- Accept: renders title/duration/objectives/keyVocabulary/materials/5E activities (phase, name, description, duration, teacherTips, understandingCheck)/assessment/homework; `validationWarning` shown as banner; long-running loader (120s) via skeleton, handles 503+Retry-After; `ResultView` all states; AI-output blocks line-height 1.7 for Indic; §12 checklist.

**P0.5 — Quiz Generator ★**
- File: `lib/features/quiz_generator/presentation/quiz_generator_screen.dart`
- Endpoint: `POST /api/ai/quiz`
- Form: topic (required) · numQuestions (stepper, default 5) · questionTypes[] (chips: multiple_choice/fill_in_the_blanks/short_answer/true_false, required) · gradeLevel · subject · language · targetDifficulty · bloomsTaxonomyLevels?
- Accept: 3 tabs Easy/Medium/Hard (null variants hidden/handled); each Question renders questionText/type/options/correctAnswer/explanation/difficultyLevel; 120s loader; §12 checklist.

**P0.6 — Instant Answer ★ (fastest first "aha")**
- File: `lib/features/instant_answer/presentation/instant_answer_screen.dart`
- Endpoint: `POST /api/ai/instant-answer`
- Form: question (multiline, required) · gradeLevel · subject · language
- Accept: renders `answer` as markdown + optional `videoSuggestionUrl`; handles 429 `DAILY_LIMIT_REACHED` with limit-reached prompt (link to /pricing, no retry); §12 checklist.

**P0.7 — Settings**
- File: `lib/features/settings/presentation/settings_screen.dart`
- Endpoint: prefs client-side + profile save; delete → `POST /api/user/delete-account` (fresh re-auth, typed "DELETE" confirm)
- Form: language (LANGUAGES — drives i18n + AI output via `AppLocale`) · theme (light/dark) · notifications (switch) · educationBoard · qualifications (multi-toggle) · administrativeRole · delete-account (destructive, typed confirm)
- Accept: language switch flips BOTH UI locale AND AI `language` param through the single `AppLocale`; theme toggle re-themes live; delete-account is guarded/destructive-styled (`error` color); logged-out shows sign-in prompt card; §12 checklist (esp. dark mode, not Hindi-only).

**P0.8 — Profile (Me)**
- File: `lib/features/profile/presentation/profile_screen.dart`
- Endpoint: read/write `users/<uid>` (same fields as P0.2); sign-out = client Firebase
- Accept: view/edit all profile fields; plan badge (free/pro/gold/premium) read from token; sign-out works → router sends to /login; §12 checklist.

### P1 — Complete the tool suite

**P1.1 — Worksheet Wizard** — `lib/features/worksheet_wizard/presentation/worksheet_wizard_screen.dart` — `POST /api/ai/worksheet`
- Form: imageDataUri (camera/gallery, **required**, base64 data-URI, cap ~14MB) · prompt (required, max 2000) · gradeLevel · subject · language
- Accept: image capture → data-URI pipeline; renders title/objectives/studentInstructions/activities(type/content/explanation/chalkboardNote)/answerKey; §12 checklist. (Pair image work with P2 camera track.)

**P1.2 — Rubric Generator** — `lib/features/rubric_generator/presentation/rubric_generator_screen.dart` — `POST /api/ai/rubric`
- Form: assignmentDescription (multiline, required, max 2000) · gradeLevel · subject · language
- Accept: renders criteria × levels grid (name/description/levels[name,description,points]); wide grid scrolls horizontally inside its container (page never scrolls sideways); §12 checklist.

**P1.3 — Exam Paper Generator** — `lib/features/exam_paper/presentation/exam_paper_screen.dart` — `POST /api/ai/exam-paper` (+ `PUT` save)
- Form: board (required) · gradeLevel (required) · subject (required) · chapters (add-chip list; ≥1 required for non-blueprinted combos) · difficulty (segmented) · language · includeAnswerKey (toggle) · includeMarkingScheme (toggle)
- Accept: renders sections/questions/blueprintSummary/pyqSources; handles **202** `generation_in_progress` (poll library) and **422** `exam_paper_unstructured` (retry-fewer-chapters) distinctly; 120s loader; PUT-to-library action; §12 checklist.

**P1.4 — Teacher Training** — `lib/features/teacher_training/presentation/teacher_training_screen.dart` — `POST /api/ai/teacher-training`
- Form: question (multiline, required, max 2000) · subject · language
- Accept: renders introduction/advice[strategy,pedagogy,explanation]/conclusion; teacher-dignity copy; §12 checklist.

**P1.5 — Parent Message** — `lib/features/parent_message/presentation/parent_message_screen.dart` — `POST /api/ai/parent-message`
- Form: studentName · className · subject · reason (select: consecutive_absences/poor_performance/behavioral_concern/positive_feedback) · reasonContext · parentLanguage (required) · teacherNote? · consecutiveAbsentDays? · teacherName? · schoolName?
- Accept: 400 on missing required surfaced; renders message + wordCount; copy / share-to-WhatsApp action on result; message renders in parentLanguage script (Indic line-height); §12 checklist.

**P1.6 — Assess Assignment** — `lib/features/assess_assignment/presentation/assess_assignment_screen.dart` — `POST /api/ai/assess-assignment`
- Form: imageDataUri (camera, **required**) · rubricSnapshot? (picker from P1.2) · language · mode (segmented full/transcribe/score). Do NOT send studentName (server strips PII).
- Accept: renders scorecard (transcript, overall score, per-criterion feedback, strengths, improvements, next steps, confidence); expects/ handles 429 (expensive model day-budget); §12 checklist. (Pair with P2 camera track.)

**P1.7 — My Library** — `lib/features/library/presentation/library_screen.dart` (bottom-nav "Library") — library list/read API over Firestore/Storage
- Accept: list saved generations (id/type/title/gradeLevel/subject/topic/language/storagePath/createdAt) with type filters; tapping re-renders the tool's result view; loading skeleton + empty + error states; §12 checklist.

**P1.8 — Create / Command Palette** — `lib/features/create_palette/presentation/create_palette_sheet.dart` (bottom-nav "Create" action, not a route)
- Accept: modal bottom sheet, searchable list of all P0–P1 tools, deep-links into each tool screen; radius-12 sheet + `shadowFloating`; §12 checklist.

### P2 — Deferred (image-gen / voice / media / social / billing)

Build after the text loop is solid. Listed with endpoints for completeness; NOT v1 ship-blockers.

| Screen | File (feature-first) | Endpoint | Why deferred |
|---|---|---|---|
| Camera→data-URI track | `lib/shared/media/image_input.dart` | (shared) | Enables P1.1/P1.6 image path |
| Visual Aid Designer | `lib/features/visual_aid/presentation/visual_aid_screen.dart` | `POST /api/ai/visual-aid` | Image gen (~$0.04/img) |
| Assessment Scanner | `lib/features/assessment_scanner/presentation/assessment_scanner_screen.dart` | `POST /api/ai/assessment-scanner` | Camera + vision OCR |
| Video Storyteller | `lib/features/video_storyteller/presentation/video_storyteller_screen.dart` | `POST /api/ai/video-storyteller` | Video |
| Virtual Field Trip | `lib/features/virtual_field_trip/presentation/virtual_field_trip_screen.dart` | `POST /api/ai/virtual-field-trip` | Media-heavy |
| Voice-to-Text | `lib/shared/media/voice_input.dart` | `POST /api/ai/voice-to-text` | Mic capture |
| Attendance | `lib/features/attendance/presentation/attendance_screen.dart` | `/api/attendance/*` | Twilio voice |
| Try/Demo Call | `lib/features/demo_call/presentation/demo_call_screen.dart` | `/api/demo-call` | Telephony; anon lead-magnet, flag-off |
| Community / Library-share | `lib/features/community/…` | community APIs | Social |
| Impact Dashboard | `lib/features/impact/…` | analytics APIs | Reporting |
| Pricing / Usage | `lib/features/pricing/…` | billing APIs | Read-only v1; checkout stays web |
| Notifications | `lib/features/notifications/…` | notifications API | Secondary |

---

## 4. Verification steps (per unit + per phase)

**Per commit unit (mandatory before commit):**
1. `dart run build_runner build --delete-conflicting-outputs` — codegen clean (Riverpod/go_router/json_serializable).
2. `flutter analyze` — **zero** issues.
3. Token-guard grep / `custom_lint` — no off-token violations (colors, spacing, radius, emoji, curves, GoogleFonts fetch).
4. For a screen: run the `DESIGN_RUBRIC.md` §12 15-point checklist; capture screenshots at 360dp + 800dp, light + dark, with the §11 Bengali/Tamil/Malayalam/Marathi test strings; confirm no clipped matras, no RenderFlex overflow, no overflow at `textScaleFactor` 1.3.
5. Commit the unit on `develop` (conventional message; no Claude attribution).

**Per phase:**
6. `flutter gen-l10n` — all 11 ARBs compile; no missing keys.
7. `flutter build apk --debug` — builds green.
8. Smoke: boot on emulator (360dp + tablet), walk the phase's new screens, verify auth redirect + one live AI call end-to-end against `https://sahayakai.com`.
9. Golden tests (reusable widgets) at 360dp + 800dp, light + dark, with Indic strings.

**Release gate (end of P0, end of P1):** full §12 sweep across all shipped screens; `flutter analyze` clean; `flutter build apk --release` green; App Check Play Integrity verified against a real device.

---

## 5. Guardrails (autonomous loop)

- **Never push to any remote.** Local commits on `develop` only.
- **Never touch `sahayakai-main`** (or any sibling repo) — this app is read-only over that backend; no backend edits.
- **Never publish** anything (no deploy, no store upload, no artifact publish).
- **Commit each unit on the `develop` branch** (branch from `develop` if not already on it; `--no-ff` for any sub-branch merges; never `git add -A`/`.` — stage explicit paths).
- Follow project rules: no emojis, no em dashes in copy, Lucide icons only, all 11 languages first-class (never Hindi-only), teacher-dignity copy.
- On any `DESIGN_RUBRIC.md` §12 FAIL: fix before commit — a failing screen blocks its own merge.
