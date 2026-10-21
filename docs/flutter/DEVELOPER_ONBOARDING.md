# SahayakAI Flutter — Developer Onboarding (start here)

**Audience:** the incoming Android / Flutter engineer taking over this app.
**Last updated:** 2026-07-28.
**Purpose:** the single "read this first" map. It tells you what the app is, what genuinely works today, what is deliberately not finished, how to build and run it, and which of the older docs to trust vs. ignore. It is written to be accurate, not flattering — if something is half-built, it says so.

---

## 0. What this app is (one paragraph)

A native **Flutter (Material 3) Android client** for SahayakAI, an AI teaching assistant for Indian school teachers. It is a **front-end only** over the existing production backend at `https://sahayakai.com` (a Next.js app) — **there is no backend in this repo and no backend rewrite is in scope.** The app authenticates with Firebase Auth + Google Sign-In, attaches the Firebase ID token as a Bearer header on every REST call to `/api/*`, and renders the responses. State is **Riverpod (code-generated)**, navigation is **`go_router`** with one auth-guard redirect, networking is **`dio`**. UI supports **11 Indic languages**. The app targets low-end rural Android hardware, so performance and offline-tolerance matter.

The single authoritative architecture reference is **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — read it after this. It documents the exact backend contract (auth headers, the `language` param, timeouts, plan values) extracted verbatim from the live backend. Do not re-derive those; honor them.

---

## 1. Toolchain & environment

| Thing | Value |
|---|---|
| Flutter | **3.41.6** (stable channel) |
| Dart | **3.11.4** (`environment: sdk: ^3.11.4`) |
| JDK | **OpenJDK 17** (`/opt/homebrew/opt/openjdk@17` on the current machine) |
| Android SDK | at `$HOME/Library/Android/sdk` on the current machine |
| Package id | `com.sargvision.sahayakai` |
| minSdk / targetSdk / compileSdk | Flutter defaults (`flutter.minSdkVersion` etc — no explicit override in `android/app/build.gradle.kts`). The Firebase plugins set the effective floor; confirm the resolved number from a release build. |
| State mgmt | `flutter_riverpod` + `riverpod_annotation` + `riverpod_generator` (**code-gen ON** — `build_runner`) |
| Routing | `go_router` |
| HTTP | `dio` |
| i18n | `flutter gen-l10n` from ARB files in `lib/core/i18n/arb/` |

Per-shell env the build expects on this machine:
```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
```

---

## 2. Get it building in ~10 minutes

```bash
# 1. clone + branch (the app lives in a subfolder of the monorepo)
git clone https://github.com/sargupta/sahayakai.git
cd sahayakai
git checkout feature/flutter-rebuild
cd sahayakai-flutter        # <-- the Flutter app root; all commands run here

# 2. deps + generated code
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # regenerates *.g.dart (Riverpod/JSON)
flutter gen-l10n                                            # regenerates localizations

# 3. install the git hooks (analyze + token-guard + i18n gate + conventional-commit check)
bash scripts/install-hooks.sh

# 4. static checks
flutter analyze                # must be 0 issues
bash scripts/token_guard.sh    # must PASS

# 5. run
flutter run                    # on a booted emulator or device
# or a debug APK:
flutter build apk --debug      # -> build/app/outputs/flutter-apk/app-debug.apk
```

**`.g.dart` files are committed** (Riverpod/JSON codegen). If `flutter analyze` complains about generated code being out of sync, run `dart run build_runner build --delete-conflicting-outputs` and commit the regenerated files. See §7 for a known wrinkle here.

---

## 3. Repository layout

```
sahayakai-flutter/
  lib/
    core/          auth, firebase, i18n, network (dio ApiClient), router, theme, platform
    shared/        widgets (ToolScaffold, ResultView, AppCard, GlassSurface, buttons…),
                   domain, data, media, voice, motion  — the reusable primitives
    features/      one folder per screen/feature (24 of them), each: presentation/ + data/ + domain/
  test/            131 test files (widget + unit); fake_cloud_firestore + a fake ApiClient, no live network
  android/         standard Flutter Android host (google-services.json is committed)
  scripts/         token_guard.sh, check_i18n_gate.sh, verify_build.sh, hooks/, install-hooks.sh
  docs/flutter/    design + architecture docs (this file is the entry point)
```

**How screens are built** (learn this pattern once, it repeats 20+ times): every AI tool screen is a `ToolScaffold` (form + sticky submit) whose result region is a `ResultView<T>` driven by an `AsyncValue<T?>` from a code-gen `AsyncNotifier` controller, which calls a `Repository` that does a `dio` POST and decodes a `json_serializable` DTO into a domain model. Loading → skeleton, error → typed `ApiException`-branched `ErrorView`, empty → `EmptyView`, data → the tool's own `*_result_view.dart`. New tools are **assembled from these primitives, not reinvented** — the previous attempt at this app died on ad-hoc layout, and this structure is the deliberate fix.

---

## 4. What genuinely works today

These are wired to the real backend / Firebase and covered by tests:

- **Auth:** Firebase Auth + Google Sign-In, real ID-token Bearer on every call, the `go_router` redirect guard, sign-out.
- **All 14 AI tool screens** (Lesson Plan, Quiz, Instant Answer, Worksheet, Rubric, Exam Paper, Teacher Training, Assess Assignment, Assessment Scanner, Visual Aid, Video Storyteller, Virtual Field Trip, Content Creator, Parent Message) — generate → render, with typed error states.
- **VIDYA** voice home (speech → tool navigation with prefill).
- **Profile / Settings / Onboarding** — real Firestore-backed reads/writes (`users/<uid>`).
- **My Library** — lists saved generations and now renders the actual saved content per type.
- **Pro Inbox** (1:1 messaging) and **Staff Room global chat** — real `cloud_firestore` reads/writes.
- **Plan & Usage** — real `GET /api/usage`.

---

## 5. What is deliberately NOT finished (do not assume these work)

Be careful here — this is the honest boundary. These are known-incomplete, not bugs to "fix" blindly:

1. **Block C — the rest of Staffroom (Groups, Teacher Directory, unified Feed, Likes, Notifications).** The client interfaces exist but return empty/"not available yet". Reason: **there is no matching REST route on the backend** for these (the web app uses Next.js *server actions*, which are not callable from a native client), and the teacher directory must be **PII-stripped server-side** — it must NOT be moved to a raw client-side Firestore read. These need backend work in `sahayakai-main` first. Interfaces to look at: `lib/features/staffroom/data/staffroom_transport.dart`, `lib/features/inbox/data/inbox_transport.dart` — each method's doc comment names the exact query/route it needs.
2. **Attendance, Community Library, Impact Dashboard, Org/School-admin dashboard** — exist on the web app, **never built on mobile.** Attendance also gates the Parent Hotline student roster (currently an honest "not available yet" empty state, not a real roster).
3. **`firebase_app_check` (Play Integrity)** — not added. The backend can require `X-Firebase-AppCheck` when `APP_CHECK_REQUIRED=true`. Wiring it wrong hard-blocks protected routes, so it was left for an owner decision (monitor → enforce timing). See [`HANDOFF.md`](./HANDOFF.md) §1.
4. **`firebase_messaging` (push notifications)** — absent. The Settings notification toggle is local-only today and controls nothing server-side.
5. **Offline mode** — scaffolded for, out of scope. Treat the app as online-only.
6. **Google Sign-In button branding** — still a Lucide glyph placeholder, not Google's official mark (their branding terms require the real asset).

---

## 6. Owner-action blockers you can't fix in code

From [`HANDOFF.md`](./HANDOFF.md) — these need account access, not engineering:

- **Release keystore SHA fingerprints are NOT registered in Firebase.** Only the shared **debug** keystore's SHA-1/SHA-256 are registered for `com.sargvision.sahayakai`. **A signed release build's Google Sign-In will fail with `DEVELOPER_ERROR` until the release keystore's SHA-1 + SHA-256 are added** in Firebase console → Project settings → the `com.sargvision.sahayakai` app. Debug builds sign in fine.
- **`google-services.json` is committed** at `android/app/google-services.json` (real `com.sargvision.sahayakai` app, Firebase project `sahayakai-b4248`). `flutterfire configure` was intentionally skipped (Android-only; `google-services.json` alone is sufficient).
- A stale `app.sahayakai.mobile` app entry exists in the Firebase console from an earlier attempt — untouched, safe to delete once confirmed nothing depends on it.

---

## 7. Conventions & gotchas (save yourself time)

- **Branch:** all work is on `feature/flutter-rebuild`. It is not merged to `main`/`develop` yet.
- **Commits:** the repo enforces **Conventional Commits with a single-word scope, no commas** (`commit-msg` hook). E.g. `fix(inbox): …`, not `fix(inbox,staffroom): …`. Put multi-area detail in the body.
- **Pre-commit hook** runs `flutter analyze` + `token_guard.sh` on staged `.dart`, and the i18n gate on staged `.arb`. Install it with `scripts/install-hooks.sh` (it's worktree-scoped, so a fresh clone needs it run once).
- **`token_guard.sh`** bans stray `print`/`console.log`-style debug output and enforces a few house rules — keep it green.
- **i18n:** 11 languages. The i18n gate (`check_i18n_gate.sh`) fails a commit if **Login/Onboarding** strings are untranslated in any language. The rest of the app has a **known translation backlog** (~460 keys still fall back to English in the 10 non-English locales) — this is tracked, not a regression you introduced. When you add a user-facing string, add it to `app_en.arb`; full 11-language translation of the backlog is a separate effort.
- **Message-length caps are CHARACTERS, not bytes.** The Firestore rules' `text.size()` is treated as a character cap by the production web app (`maxLength={1000}`, "max 1000 chars"). The client guards use `String.length` to match. (An earlier pass briefly used UTF-8 byte counts, which wrongly blocked normal-length Indic messages — corrected. Don't reintroduce byte counting.)
- **Stale `.g.dart` drift:** four generated files (`api_providers.g.dart`, `app_router.g.dart`, `messages_stream_provider.g.dart`, `vidya_controller.g.dart`) may show as modified in a fresh checkout due to `build_runner` hash churn. They are harmless (analyze stays green); regenerate + commit if you want a clean tree.

---

## 8. Tests

- **131 test files**, run with `flutter test`. Widget tests use a fake `ApiClient` and `fake_cloud_firestore` — no live network or real Firebase.
- **Known pre-existing failures:** `test/features/create_palette/create_palette_test.dart` has **13 failing tests** from an ambiguous-widget-finder issue (a test bug, not an app bug). Everything else is green. When you run the full suite, expect exactly those 13; anything else is yours.
- Run with a per-test timeout (`flutter test --timeout 90s`) — a couple of tests that touch app-boot can hang without it.
- Do **not** call the real `Firebase.initializeApp()` in a unit test — it hangs (firebase_core 3.x uses Pigeon, not a mockable MethodChannel). Inject failures via the existing `FakeBootstrap` / provider overrides instead (see `test/features/splash/splash_init_failure_test.dart` for the pattern).

---

## 9. Recent work & the quality backlog (context, not homework)

This app went through two recent remediation passes (all on `feature/flutter-rebuild`, all pushed):
- A **glassmorphism design reskin** (the `GlassSurface`/`AppCard` material system).
- A **quality remediation** driven by a 39-agent code audit that produced **176 verified findings**. The **45 critical + high** findings are **fixed** (dead-ends, silent failures, the Library-render gaps, money/data-integrity bugs, the translation infra, etc). The **~131 medium + low** findings are **not yet done** and are the natural next backlog. The full audit report is a standalone artifact — ask the owner for the link.
- One tracked cross-cutting issue: **Worksheet and Exam Paper both auto-save a Library entry on generation AND expose a manual "Save" button**, so tapping Save can create a duplicate row. This is a product decision spanning both tools + the backend, ticketed separately, not yet resolved.

---

## 10. Which older docs to trust

- **Trust:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) (authoritative backend contract + architecture), [`HANDOFF.md`](./HANDOFF.md) (owner-action blockers), the `docs/flutter/design/` specs (the design system), the `docs/flutter/pillars/SPEC_*.md` (feature specs).
- **Treat as historical / possibly stale:** `SESSION_CHECKPOINT.md` (dated 2026-07-20, predates the remediation work and describes an older worktree layout), and any "BUILT-PENDING-FIREBASE" / "P0.2 stub" comments still lingering in code — several of those describe a pre-auth state that has since been wired. When a code comment and this doc disagree, prefer this doc and verify against the actual code.

---

*This file is the entry point; keep it current as the source of truth for a new engineer. If you change what works vs. what's pending, update §4 and §5 here first.*
