# SahayakAI — Native Flutter (Android) Architecture

**Status:** v1 architecture spec (authoritative)
**Last updated:** 2026-07-17
**Toolchain target:** Flutter 3.41.6 / Dart 3.11.4 (`environment: sdk: ^3.11.4`)
**Backend:** existing production at `https://sahayakai.com` — **NO backend rewrite**. The app is a native front-end over the same Next.js API the web app calls.
**Scope of v1:** online-only. Offline is scaffolded-for but out of scope (see §12).

---

## 0. One-paragraph summary

A fresh, feature-first Flutter (Material 3) Android client for SahayakAI that talks to the unchanged production backend at `https://sahayakai.com`. State is **Riverpod (code-generated with `riverpod_generator`)**; navigation is **`go_router`** with a single `redirect` auth guard driven by the Firebase auth-state stream; networking is a **`dio`** client whose one request interceptor pulls a fresh **Firebase ID token** and sets `Authorization: Bearer <token>` — exactly what the production middleware expects before it verifies the token and injects `x-user-id`/`x-user-plan` downstream. Auth is `firebase_auth` + `google_sign_in`, with **App Check (Play Integrity)** attaching `X-Firebase-AppCheck` on every call. i18n covers 11 Indic languages via **`flutter gen-l10n` (ARB)** for UI strings, with per-script **Noto** fonts bundled and a single source-of-truth `Language` enum that also supplies the `language` (full English name) parameter every AI endpoint expects. Cross-cutting UX is standardized through a reusable `ToolScaffold` + `ResultView` pair backed by an `AsyncValue`-driven loading/error/empty state machine, and all wire models are `json_serializable`. The previous app died on layout/design, so this document fixes exact packages, versions, folder boundaries, and reusable shells so screens are assembled, not reinvented.

---

## 1. Backend contract (what the client MUST honor)

These are extracted verbatim from the live app; the Flutter client is built to satisfy them.

| Fact | Value | Source |
|---|---|---|
| API origin | `https://sahayakai.com` (canonical host is `www.sahayakai.com`; apex 308-redirects to www for all non-`/api/` paths) | `src/middleware.ts` L106–120 |
| Auth scheme | `Authorization: Bearer <Firebase ID token>` on API calls | `src/middleware.ts` L242–246 |
| Server identity injection | Middleware verifies the ID token, then sets `x-user-id`, `x-user-plan`, `x-user-email`, `x-user-name` request headers. **Client-supplied `x-user-*` headers are stripped unconditionally** — never send them. | `src/middleware.ts` L153–161, L268–310 |
| Firebase project | `sahayakai-b4248` (project number `640589855975`) | `src/middleware.ts` L10; `src/lib/firebase.ts` |
| App Check | Optional-then-strict. When `APP_CHECK_REQUIRED=true`, every `/api/ai/*` call must carry `X-Firebase-AppCheck`; invalid token → 401 | `src/middleware.ts` L223–238 |
| Auth failure semantics | Invalid/absent token on `/api/*` or `/admin/*` → **401 JSON `{error}`** (not 500). Client treats 401 as "sign in again". | `src/middleware.ts` L311–331 |
| Plan values | `free \| pro \| gold \| premium` (legacy `institution`→`premium`) from custom claim `planType` | `src/middleware.ts` L296–302 |
| AI `language` param | Full English name string, one of: `English, Hindi, Bengali, Kannada, Tamil, Telugu, Marathi, Gujarati, Punjabi, Malayalam, Odia` | `src/app/api/ai/lesson-plan/route.ts`; `src/lib/detect-language.ts` L49–52 |
| AI timeouts | Server allows up to 120 s (`export const maxDuration = 120`) for generation routes | `src/app/api/ai/lesson-plan/route.ts` |

**Client web-config (browser-exposed by design, safe to embed):**

```
apiKey             AIzaSyBKgCKW4e6YpM4HHIgAhwhJwmyQ0wRGCtw   (web key; Android uses its own from google-services.json)
projectId          sahayakai-b4248
storageBucket      sahayakai-b4248-mumbai
messagingSenderId  640589855975
appId (web)        1:640589855975:web:624436f873a78069aa3642
RTDB               https://sahayakai-b4248-default-rtdb.asia-southeast1.firebasedatabase.app
```

> Android does **not** reuse the web `appId`. Run `flutterfire configure --project=sahayakai-b4248` to generate `lib/firebase_options.dart` and place `android/app/google-services.json` (handoff item, see §5).

---

## 2. State management — Riverpod (code-generated)

**Decision: `flutter_riverpod` + `riverpod_annotation` with `riverpod_generator` (code-gen ON).**

Justification:
- **Compile-time safety over the predecessor's failure mode.** The old app failed on layout/state coupling. Code-gen providers remove hand-written `Provider`/`StateNotifierProvider` boilerplate and the family-parameter footguns, so screens can't silently read a mistyped provider.
- **`AsyncValue` is the backbone of every AI screen.** Each tool is "submit → await a 120 s POST → render result". `AsyncNotifier`/`FutureProvider` give `.when(data/loading/error)` for free, which is exactly what the `ResultView` state machine (§9) consumes.
- **`ref.watch(authStateProvider)` drives the router redirect** (§3) — Riverpod's stream providers integrate cleanly with `go_router`'s `refreshListenable`/`Listenable` bridge.
- **`autoDispose` by default** with code-gen: per-tool controllers are torn down on screen exit, so a heavy lesson-plan result doesn't leak while the teacher moves to the next tool.
- **Testability:** `ProviderContainer` + `overrideWith` lets us fake the `ApiClient` in widget tests without a running backend.

Sample provider — the auth-state stream that the router listens to, plus a code-gen AI controller:

```dart
// lib/core/auth/auth_providers.dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'auth_providers.g.dart';

/// Firebase Auth singleton.
@Riverpod(keepAlive: true)
FirebaseAuth firebaseAuth(Ref ref) => FirebaseAuth.instance;

/// Streams the current user; null when signed out.
/// The router's redirect guard watches this.
@Riverpod(keepAlive: true)
Stream<User?> authState(Ref ref) =>
    ref.watch(firebaseAuthProvider).authStateChanges();

/// Convenience: is a user currently signed in (sync snapshot).
@riverpod
bool isSignedIn(Ref ref) =>
    ref.watch(authStateProvider).valueOrNull != null;
```

```dart
// lib/features/lesson_planner/presentation/lesson_plan_controller.dart
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../data/lesson_plan_repository.dart';
import '../domain/lesson_plan.dart';
import '../domain/lesson_plan_request.dart';

part 'lesson_plan_controller.g.dart';

/// One controller per AI tool. Starts idle (null); `generate()` flips it
/// to loading, then data|error. ToolScaffold/ResultView render off this.
@riverpod
class LessonPlanController extends _$LessonPlanController {
  @override
  AsyncValue<LessonPlan?> build() => const AsyncValue.data(null);

  Future<void> generate(LessonPlanRequest req) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(lessonPlanRepositoryProvider).generate(req),
    );
  }

  void reset() => state = const AsyncValue.data(null);
}
```

Rule: **UI never calls `dio` directly.** `presentation → controller (Notifier) → repository (data) → ApiClient`. See §7.

---

## 3. Routing — `go_router`

**Decision: `go_router` with a single top-level `redirect` auth guard**, rebuilt on auth changes via a `GoRouter.refreshListenable` bridged to the Riverpod auth stream.

### 3.1 Screen inventory → route table

The web app exposes 47 `page.tsx` routes; the v1 Android app ships the teacher-facing subset (marketing/admin/organization pages are web-only). Route table:

| Path | Screen | Auth | Notes |
|---|---|---|---|
| `/splash` | Splash / bootstrap | public | resolves initial auth + App Check, then redirects |
| `/login` | Login (Google Sign-In) | public-only | redirect away if already signed in |
| `/onboarding` | Profile onboarding | auth | gate is DEFAULT-OFF server-side; keep screen but don't hard-gate v1 |
| `/` | Home / dashboard | auth | tool grid |
| `/lesson-plan` | Lesson Plan generator | auth | `POST /api/ai/lesson-plan` |
| `/worksheet-wizard` | Worksheet Wizard | auth | `POST /api/ai/worksheet` |
| `/quiz-generator` | Quiz Generator | auth | `POST /api/ai/quiz` |
| `/exam-paper` | Exam Paper | auth | `POST /api/ai/exam-paper` |
| `/rubric-generator` | Rubric Generator | auth | `POST /api/ai/rubric` |
| `/instant-answer` | Instant Answer | auth | `POST /api/ai/instant-answer` |
| `/visual-aid-designer` | Visual Aid Designer | auth | `POST /api/ai/visual-aid` |
| `/video-storyteller` | Video Storyteller | auth | `POST /api/ai/video-storyteller` |
| `/virtual-field-trip` | Virtual Field Trip | auth | `POST /api/ai/virtual-field-trip` |
| `/content-creator` | Content Creator | auth | |
| `/teacher-training` | Teacher Training | auth | `POST /api/ai/teacher-training` |
| `/assessment-scanner` | Assessment Scanner | auth | image upload → `POST /api/ai/assessment-scanner` |
| `/assess-assignment` | Assess Assignment | auth | `POST /api/ai/assess-assignment` |
| `/attendance` | Attendance (class list) | auth | |
| `/attendance/:classId` | Attendance detail | auth | path param |
| `/my-library` | My Library | auth | saved generations |
| `/community` | Community | auth | |
| `/community-library` | Community Library | auth | |
| `/messages` | Messages | auth | |
| `/notifications` | Notifications | auth | |
| `/impact-dashboard` | Impact Dashboard | auth | |
| `/usage` | Usage | auth | |
| `/my-profile` | My Profile | auth | |
| `/settings` | Settings (language, account) | auth | |
| `/pricing` | Pricing / plans | auth | read-only in v1; checkout stays on web |
| `/try-call` | Demo parent call | public | anon lead magnet, gated server-side |

Deferred to later versions (web-only for now): `/admin/*`, `/organization/dashboard`, `/review-panel`, `/submit-content`, `/api-playground`, `/api-docs`, `/teacher` marketing locales, `/profile/:uid` public profiles.

### 3.2 Router with redirect guard

```dart
// lib/core/router/app_router.dart
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../auth/auth_providers.dart';
import 'routes.dart';

part 'app_router.g.dart';

/// Bridges a Riverpod stream to a Listenable so GoRouter re-evaluates
/// `redirect` whenever auth state changes.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(Ref ref) {
    ref.listen(authStateProvider, (_, __) => notifyListeners());
  }
}

@Riverpod(keepAlive: true)
GoRouter appRouter(Ref ref) {
  final refresh = _AuthRefresh(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: Routes.splash,
    refreshListenable: refresh,
    redirect: (context, state) {
      final authAsync = ref.read(authStateProvider);

      // Still resolving the very first auth snapshot → park on splash.
      if (authAsync.isLoading || !authAsync.hasValue) {
        return state.matchedLocation == Routes.splash ? null : Routes.splash;
      }

      final signedIn = authAsync.valueOrNull != null;
      final loc = state.matchedLocation;
      final isPublic = Routes.publicPaths.contains(loc);

      // Signed out on a protected route → login (preserve intended dest).
      if (!signedIn && !isPublic) {
        return '${Routes.login}?next=${Uri.encodeComponent(loc)}';
      }
      // Signed in but sitting on login/splash → go home (honor ?next).
      if (signedIn && (loc == Routes.login || loc == Routes.splash)) {
        final next = state.uri.queryParameters['next'];
        return (next != null && next.isNotEmpty) ? next : Routes.home;
      }
      return null; // no redirect
    },
    routes: $appRoutes, // generated by go_router_builder (typed routes)
    errorBuilder: (c, s) => const NotFoundScreen(),
  );
}
```

`Routes.publicPaths = {Routes.splash, Routes.login, Routes.tryCall}`. Typed routes come from `go_router_builder` so `const LessonPlanRoute().go(context)` replaces stringly-typed navigation — another guard against the predecessor's layout/routing drift.

---

## 4. Networking — `dio`

**Decision: one `Dio` instance, configured in `lib/core/network/`, with an auth interceptor, an App Check interceptor, and a centralized error mapper producing a typed `ApiException`.**

### 4.1 Config

```dart
// lib/core/network/dio_config.dart
const String kApiBaseUrl = 'https://sahayakai.com';

// AI generation can take up to the server's maxDuration = 120 s.
const kConnectTimeout = Duration(seconds: 15);
const kReceiveTimeout = Duration(seconds: 125); // > server 120 s ceiling
const kSendTimeout    = Duration(seconds: 60);  // covers image uploads
```

### 4.2 Auth interceptor (fetches Firebase ID token, sets Bearer + App Check)

```dart
// lib/core/network/auth_interceptor.dart
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_app_check/firebase_app_check.dart';

/// Attaches `Authorization: Bearer <Firebase ID token>` and
/// `X-Firebase-AppCheck` to every request. The production middleware
/// verifies the ID token and injects x-user-id downstream; it strips any
/// client-set x-user-* headers, so we never send those.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor(this._auth, this._appCheck);

  final FirebaseAuth _auth;
  final FirebaseAppCheck _appCheck;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final user = _auth.currentUser;
    if (user != null) {
      try {
        // getIdToken() returns a cached token and refreshes automatically
        // when it is within 5 min of expiry; pass true only on 401 retry.
        final token = await user.getIdToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
      } on FirebaseAuthException catch (_) {
        // Fall through unauthenticated; server returns 401 → handled below.
      }
    }

    // App Check (Play Integrity on Android). Best-effort: absence is
    // tolerated until the server flips APP_CHECK_REQUIRED=true for /api/ai/*.
    try {
      final appCheckToken = await _appCheck.getToken();
      if (appCheckToken != null) {
        options.headers['X-Firebase-AppCheck'] = appCheckToken;
      }
    } catch (_) {/* tolerate */}

    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // One forced-refresh retry on 401 (token may have just expired).
    final res = err.response;
    final alreadyRetried = err.requestOptions.extra['__retried__'] == true;
    if (res?.statusCode == 401 && !alreadyRetried) {
      final user = _auth.currentUser;
      if (user != null) {
        try {
          final fresh = await user.getIdToken(true); // force refresh
          final opts = err.requestOptions
            ..extra['__retried__'] = true
            ..headers['Authorization'] = 'Bearer $fresh';
          final dio = Dio(BaseOptions(baseUrl: opts.baseUrl));
          final clone = await dio.fetch(opts);
          return handler.resolve(clone);
        } catch (_) {/* fall through to mapper */}
      }
    }
    handler.next(err);
  }
}
```

> `QueuedInterceptor` serializes concurrent requests through the async token fetch, so a screen that fires three parallel calls triggers exactly one token refresh, not three.

### 4.3 Client factory + error mapper

```dart
// lib/core/network/api_client.dart
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'auth_interceptor.dart';
import 'dio_config.dart';
import 'api_exception.dart';

class ApiClient {
  ApiClient({FirebaseAuth? auth, FirebaseAppCheck? appCheck})
      : _dio = Dio(BaseOptions(
          baseUrl: kApiBaseUrl,
          connectTimeout: kConnectTimeout,
          receiveTimeout: kReceiveTimeout,
          sendTimeout: kSendTimeout,
          responseType: ResponseType.json,
          headers: {'Content-Type': 'application/json'},
          // Never auto-follow the apex→www 308 by dropping the body;
          // we already target the canonical origin, so keep it simple.
          validateStatus: (s) => s != null && s < 400,
        )) {
    _dio.interceptors.add(AuthInterceptor(
      auth ?? FirebaseAuth.instance,
      appCheck ?? FirebaseAppCheck.instance,
    ));
    assert(() {
      _dio.interceptors.add(LogInterceptor(requestBody: true, responseBody: true));
      return true;
    }());
  }

  final Dio _dio;

  Future<T> post<T>(
    String path, {
    Object? data,
    required T Function(Map<String, dynamic> json) decode,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(path, data: data);
      return decode(res.data ?? const {});
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    required T Function(dynamic json) decode,
  }) async {
    try {
      final res = await _dio.get(path, queryParameters: query);
      return decode(res.data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}
```

```dart
// lib/core/network/api_exception.dart
import 'package:dio/dio.dart';

enum ApiErrorKind { network, timeout, unauthorized, forbidden, notFound,
                    rateLimited, server, badResponse, cancelled, unknown }

class ApiException implements Exception {
  const ApiException(this.kind, this.message, {this.statusCode, this.raw});

  final ApiErrorKind kind;
  final String message;      // user-safe, localizable key or text
  final int? statusCode;
  final Object? raw;

  bool get isAuth => kind == ApiErrorKind.unauthorized;

  factory ApiException.fromDio(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException(ApiErrorKind.timeout,
            'The request took too long. Please try again.', raw: e);
      case DioExceptionType.connectionError:
        return ApiException(ApiErrorKind.network,
            'No internet connection.', raw: e);
      case DioExceptionType.cancel:
        return const ApiException(ApiErrorKind.cancelled, 'Cancelled.');
      case DioExceptionType.badResponse:
        final code = e.response?.statusCode ?? 0;
        final serverMsg = _extractMessage(e.response?.data);
        return switch (code) {
          401 => ApiException(ApiErrorKind.unauthorized,
                    'Please sign in again.', statusCode: 401, raw: e),
          403 => ApiException(ApiErrorKind.forbidden,
                    serverMsg ?? 'You do not have access to this.',
                    statusCode: 403, raw: e),
          404 => ApiException(ApiErrorKind.notFound,
                    'Not found.', statusCode: 404, raw: e),
          429 => ApiException(ApiErrorKind.rateLimited,
                    serverMsg ?? 'You have reached your usage limit.',
                    statusCode: 429, raw: e),
          _ when code >= 500 => ApiException(ApiErrorKind.server,
                    'Something went wrong on our side.',
                    statusCode: code, raw: e),
          _ => ApiException(ApiErrorKind.badResponse,
                    serverMsg ?? 'Unexpected response.',
                    statusCode: code, raw: e),
        };
      default:
        return ApiException(ApiErrorKind.unknown,
            e.message ?? 'Unknown error.', raw: e);
    }
  }

  static String? _extractMessage(dynamic data) {
    if (data is Map && data['error'] is String) return data['error'] as String;
    return null;
  }

  @override
  String toString() => 'ApiException($kind, $statusCode): $message';
}
```

The `429`/`403` `serverMsg` extraction matches the backend's `{ "error": "..." }` shape (plan-guard, rate-limit, and 401 bodies all use that key).

---

## 5. Auth — Firebase + Google Sign-In + App Check

Packages: `firebase_core`, `firebase_auth`, `google_sign_in`, `firebase_app_check`.

- **`lib/firebase_options.dart` is generated**, not hand-written: `flutterfire configure --project=sahayakai-b4248` (handoff item — needs the SARGVISION Firebase console). This also drops `android/app/google-services.json` and registers the Android app's SHA-1/SHA-256 (required for Google Sign-In **and** Play Integrity App Check).
- **App Check on Android uses Play Integrity** (the web app uses reCAPTCHA v3; Android's native equivalent is Play Integrity). Init in `main()` before any API call:

```dart
// lib/main.dart (bootstrap)
Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  await FirebaseAppCheck.instance.activate(
    androidProvider: kDebugMode
        ? AndroidProvider.debug          // debug token in dev
        : AndroidProvider.playIntegrity, // Play Integrity in release
  );
  runApp(const ProviderScope(child: SahayakApp()));
}
```

- **Sign-in flow (native, no redirect):**

```dart
// lib/core/auth/auth_repository.dart
Future<UserCredential> signInWithGoogle() async {
  final gUser = await GoogleSignIn().signIn();
  if (gUser == null) throw const ApiException(ApiErrorKind.cancelled, 'Sign-in cancelled.');
  final gAuth = await gUser.authentication;
  final cred = GoogleAuthProvider.credential(
    idToken: gAuth.idToken,
    accessToken: gAuth.accessToken,
  );
  return FirebaseAuth.instance.signInWithCredential(cred);
}
Future<void> signOut() async {
  await GoogleSignIn().signOut();
  await FirebaseAuth.instance.signOut();
}
```

- **Auth-state provider** is `authStateProvider` (§2). It is the single source of truth for both the router redirect and the "am I signed in" UI.
- The client **must not** persist or send `x-user-*` headers — identity is derived server-side from the verified token. The profile-complete cookie / onboarding gate is a web-middleware concern that is **DEFAULT-OFF** in prod; the Android app keeps an `/onboarding` screen but does not hard-block on it in v1.

---

## 6. Internationalization — 11 languages

**Decision: `flutter gen-l10n` (ARB + generated `AppLocalizations`), NOT `easy_localization`.**

Justification:
- **Compile-time key safety.** `gen-l10n` generates a typed `AppLocalizations` class; a missing/renamed key is a compile error, not a runtime blank. Given the predecessor died on presentation bugs, catching missing strings at build time is worth the slightly more verbose setup.
- **First-party, zero runtime dependency.** No extra package to version-pin against Flutter 3.41.6; `flutter_localizations` ships with the SDK.
- **ICU plural/select/gender built in** — needed for count-based teacher strings ("1 student" / "5 students") across languages with different plural rules.
- `easy_localization` is rejected: runtime string keys (stringly-typed, no compile check), and it duplicates locale-resolution logic the framework already owns.

### 6.1 The 11 locales

| Language | Locale | Script | Noto font family |
|---|---|---|---|
| English | `en` | Latin | (Roboto / system) |
| Hindi | `hi` | Devanagari | Noto Sans Devanagari |
| Marathi | `mr` | Devanagari | Noto Sans Devanagari |
| Bengali | `bn` | Bengali | Noto Sans Bengali |
| Kannada | `kn` | Kannada | Noto Sans Kannada |
| Tamil | `ta` | Tamil | Noto Sans Tamil |
| Telugu | `te` | Telugu | Noto Sans Telugu |
| Gujarati | `gu` | Gujarati | Noto Sans Gujarati |
| Punjabi | `pa` | Gurmukhi | Noto Sans Gurmukhi |
| Malayalam | `ml` | Malayalam | Noto Sans Malayalam |
| Odia | `or` | Odia | Noto Sans Oriya |

### 6.2 Font strategy

Bundle the Noto script fonts as assets (do **not** rely on `google_fonts`' network fetch — the target users are rural/low-connectivity and the old app's layout broke on missing glyphs → tofu boxes). Register per-family in `pubspec.yaml` (§11) and set `ThemeData.fontFamilyFallback` so any script renders even if a widget's primary family lacks the glyph:

```dart
// lib/core/theme/app_theme.dart
textTheme: base.textTheme.apply(
  fontFamilyFallback: const [
    'NotoSansDevanagari', 'NotoSansBengali', 'NotoSansKannada',
    'NotoSansTamil', 'NotoSansTelugu', 'NotoSansGujarati',
    'NotoSansGurmukhi', 'NotoSansMalayalam', 'NotoSansOriya',
  ],
),
```

### 6.3 `l10n.yaml`

```yaml
# l10n.yaml (repo root)
arb-dir: lib/core/i18n/arb
template-arb-file: app_en.arb
output-localization-file: app_localizations.dart
output-class: AppLocalizations
nullable-getter: false
```

Supported locales declared on `MaterialApp.router`:

```dart
supportedLocales: AppLocale.values.map((l) => l.flutterLocale).toList(),
localizationsDelegates: const [
  AppLocalizations.delegate,
  GlobalMaterialLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
],
locale: ref.watch(localeProvider), // user override; default = device
```

### 6.4 Single language source of truth (UI locale ↔ AI `language` param)

The AI endpoints do **not** take a locale code — they take the full English name (`"Kannada"`). One enum bridges both so the two never drift:

```dart
// lib/core/i18n/app_locale.dart
enum AppLocale {
  en('en', 'English',   'English'),
  hi('hi', 'Hindi',     'हिन्दी'),
  bn('bn', 'Bengali',   'বাংলা'),
  kn('kn', 'Kannada',   'ಕನ್ನಡ'),
  ta('ta', 'Tamil',     'தமிழ்'),
  te('te', 'Telugu',    'తెలుగు'),
  mr('mr', 'Marathi',   'मराठी'),
  gu('gu', 'Gujarati',  'ગુજરાતી'),
  pa('pa', 'Punjabi',   'ਪੰਜਾਬੀ'),
  ml('ml', 'Malayalam', 'മലയാളം'),
  or('or', 'Odia',      'ଓଡ଼ିଆ');

  const AppLocale(this.code, this.aiName, this.nativeLabel);
  final String code;        // BCP-47 language subtag → Locale
  final String aiName;      // exact `language` param the API expects
  final String nativeLabel; // shown in the language switcher

  Locale get flutterLocale => Locale(code);
  String get bcp47In => '$code-IN'; // TTS targetLang, matches web
}
```

- **UI strings** flow: device/user selection → `localeProvider` (Riverpod, persisted via `shared_preferences`) → `MaterialApp.locale` → `AppLocalizations.of(context)`.
- **AI `language` param** flow: the same selected `AppLocale.aiName` is put into every AI request body (`LessonPlanRequest.language = locale.aiName`). One switcher, two consumers, zero drift.

---

## 7. Folder structure (feature-first)

```
lib/
  main.dart                        # bootstrap(): Firebase, App Check, ProviderScope
  app.dart                         # SahayakApp: MaterialApp.router + theme + l10n
  core/
    theme/
      app_theme.dart               # Material 3 ColorScheme, Noto fallbacks
      app_colors.dart              # SARGVISION saffron palette tokens
      app_spacing.dart             # spacing/typography scale (kills layout drift)
    network/
      api_client.dart
      auth_interceptor.dart
      dio_config.dart
      api_exception.dart
    router/
      app_router.dart              # GoRouter + redirect guard
      routes.dart                  # path constants + publicPaths set
    auth/
      auth_providers.dart          # firebaseAuth, authState, isSignedIn
      auth_repository.dart         # Google sign-in / sign-out
    i18n/
      app_locale.dart              # the 11-language enum (source of truth)
      locale_provider.dart         # persisted user override
      arb/                         # app_en.arb, app_hi.arb, … app_or.arb (11)
  features/
    <feature>/                     # e.g. lesson_planner, quiz_generator, library
      data/
        <feature>_repository.dart  # calls ApiClient, returns domain models
        dtos/                      # *.g.dart json_serializable request/response
      domain/
        <feature>.dart             # immutable domain model(s)
        <feature>_request.dart
      presentation/
        <feature>_screen.dart      # composes ToolScaffold + inputs
        <feature>_controller.dart  # @riverpod AsyncNotifier
        widgets/                   # feature-local widgets only
  shared/
    widgets/
      tool_scaffold.dart           # §9 reusable tool page shell
      result_view.dart             # §9 async state machine renderer
      app_skeleton.dart            # shimmer loading placeholders
      error_view.dart
      empty_view.dart
      primary_button.dart
      language_switcher.dart
    models/
      paginated.dart               # shared wire wrappers
```

Boundaries (enforced by review + `import_lint`-style discipline):
- `presentation` may import `domain` + `shared`, never another feature's `data`.
- `data` returns `domain` models only — DTOs never leak into `presentation`.
- `core` imports nothing from `features`.

---

## 8. Data models — `json_serializable`

All wire types use `json_serializable` + `json_annotation` with `freezed`-free plain immutable classes (const constructors) to keep codegen light. Field names match the backend JSON exactly.

```dart
// lib/features/lesson_planner/data/dtos/lesson_plan_request.dart
import 'package:json_annotation/json_annotation.dart';
part 'lesson_plan_request.g.dart';

@JsonSerializable(includeIfNull: false)
class LessonPlanRequest {
  const LessonPlanRequest({
    required this.topic,
    this.gradeLevels = const [],
    this.language = 'English',      // AppLocale.aiName
    this.resourceLevel = 'low',
    this.difficultyLevel = 'standard',
    this.useRuralContext = true,
  });
  final String topic;
  final List<String> gradeLevels;
  final String language;
  final String resourceLevel;       // low|medium|high
  final String difficultyLevel;     // remedial|standard|advanced
  final bool useRuralContext;

  Map<String, dynamic> toJson() => _$LessonPlanRequestToJson(this);
}
```

Response DTOs mirror the endpoint's JSON and expose a `toDomain()` mapper. Repositories decode via `ApiClient.post(..., decode: (j) => LessonPlanResponse.fromJson(j).toDomain())`.

`build_runner` runs codegen for Riverpod + go_router + json_serializable in one pass:
`dart run build_runner build --delete-conflicting-outputs`.

---

## 9. Cross-cutting UX patterns (the layout-failure insurance)

The predecessor failed on layout/design. v1 standardizes every tool screen through two widgets so individual screens can't invent their own (broken) layout.

### 9.1 `ToolScaffold` — every AI tool page

```dart
// lib/shared/widgets/tool_scaffold.dart
class ToolScaffold extends StatelessWidget {
  const ToolScaffold({
    super.key,
    required this.title,
    required this.child,      // the input form
    this.result,             // ResultView goes here
    this.onSubmit,
    this.submitLabel,
    this.isBusy = false,
  });
  final String title;
  final Widget child;
  final Widget? result;
  final VoidCallback? onSubmit;
  final String? submitLabel;
  final bool isBusy;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: AppSpacing.pagePadding,
            child: ConstrainedBox(
              // Cap width on tablets so forms don't stretch edge-to-edge —
              // a specific layout bug class from the old app.
              constraints: const BoxConstraints(maxWidth: 640),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  child,
                  if (result != null) ...[
                    const SizedBox(height: AppSpacing.lg),
                    result!,
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
      bottomNavigationBar: onSubmit == null
          ? null
          : SafeArea(
              child: Padding(
                padding: AppSpacing.pagePadding,
                child: PrimaryButton(
                  label: submitLabel ?? 'Generate',
                  onPressed: isBusy ? null : onSubmit,
                  isBusy: isBusy,
                ),
              ),
            ),
    );
  }
}
```

### 9.2 `ResultView` — the async state machine

Renders `AsyncValue<T?>` into the four canonical states. `null` data = **empty/idle**; error = mapped `ApiException`; loading = skeleton.

```dart
// lib/shared/widgets/result_view.dart
class ResultView<T> extends StatelessWidget {
  const ResultView({
    super.key,
    required this.state,
    required this.onData,
    this.onRetry,
    this.emptyMessage,
    this.skeleton,
  });
  final AsyncValue<T?> state;
  final Widget Function(T data) onData;
  final VoidCallback? onRetry;
  final String? emptyMessage;
  final Widget? skeleton;

  @override
  Widget build(BuildContext context) {
    return state.when(
      loading: () => skeleton ?? const AppSkeleton(),
      error: (e, _) {
        final api = e is ApiException
            ? e
            : const ApiException(ApiErrorKind.unknown, 'Something went wrong.');
        // Auth errors bubble to a global handler that pushes /login.
        return ErrorView(
          message: api.message,
          onRetry: api.isAuth ? null : onRetry,
        );
      },
      data: (value) => value == null
          ? EmptyView(message: emptyMessage ?? 'Fill in the form and tap Generate.')
          : onData(value),
    );
  }
}
```

- **Loading:** `AppSkeleton` = `shimmer`-based placeholder blocks (never a bare spinner for content areas; spinner only inside the submit button).
- **Error:** `ErrorView` shows the localized `ApiException.message` + a retry button (suppressed for auth errors, which redirect to `/login`).
- **Empty/idle:** `EmptyView` with an illustration + call-to-action.
- **401 handling:** a global `ref.listen` on controllers (or an interceptor callback) that, on `ApiException.isAuth`, triggers `signOut()` → router redirect sends the user to `/login`.

A tool screen becomes pure composition:

```dart
class LessonPlanScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(lessonPlanControllerProvider);
    return ToolScaffold(
      title: context.l10n.lessonPlanTitle,
      isBusy: state.isLoading,
      onSubmit: () => ref.read(lessonPlanControllerProvider.notifier)
          .generate(_buildRequest(ref)),
      result: ResultView<LessonPlan>(
        state: state,
        onData: (lp) => LessonPlanResultCard(plan: lp),
        onRetry: () => ref.read(lessonPlanControllerProvider.notifier)
            .generate(_buildRequest(ref)),
      ),
      child: const LessonPlanForm(),
    );
  }
}
```

### 9.3 Theme / design tokens

Material 3 with `ColorScheme.fromSeed` on the SARGVISION saffron seed, all spacing/radius/typography pulled from `AppSpacing`/`app_colors.dart` constants (no magic numbers in screens). Icons: Material Symbols only (no emoji, per brand rules). This token layer is the structural fix for the old app's inconsistent spacing/hierarchy.

---

## 10. Error, loading, empty — summary matrix

| State | Trigger | Widget | Behavior |
|---|---|---|---|
| Idle | controller `data(null)` | `EmptyView` | prompt to fill form |
| Loading | `AsyncValue.loading()` | `AppSkeleton` (shimmer) + button spinner | inputs disabled |
| Success | `data(value)` | feature result card | scroll to result |
| Network/timeout | `ApiException(network/timeout)` | `ErrorView` + retry | offline banner if network |
| Rate-limited 429 | `ApiException(rateLimited)` | `ErrorView` (no retry) | link to `/pricing` |
| Forbidden 403 | plan-guard | `ErrorView` (no retry) | link to `/pricing` |
| Unauthorized 401 | expired/invalid token | global → `/login` | after one silent refresh retry |
| Server 5xx | `ApiException(server)` | `ErrorView` + retry | generic apology copy |

---

## 11. `pubspec.yaml` — exact dependency list

Versions pinned for **Flutter 3.41.6 / Dart 3.11.4** (`sdk: ^3.11.4`). Use caret ranges; lock via `pubspec.lock`.

```yaml
name: sahayakai
description: "SahayakAI — native Android app (SARGVISION Intelligence)"
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: ^3.11.4

dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter

  # State management (code-gen)
  flutter_riverpod: ^2.6.1
  riverpod_annotation: ^2.6.1

  # Routing
  go_router: ^14.6.2

  # Networking
  dio: ^5.7.0

  # Firebase (auth + attestation)
  firebase_core: ^3.8.0
  firebase_auth: ^5.3.4
  firebase_app_check: ^0.3.2+4
  google_sign_in: ^6.2.2

  # Serialization
  json_annotation: ^4.9.0

  # Local persistence (locale override, lightweight cache)
  shared_preferences: ^2.3.3

  # UI / UX
  shimmer: ^3.0.0                 # skeleton loaders
  cached_network_image: ^3.4.1    # result images / avatars
  cupertino_icons: ^1.0.8

  # i18n runtime helpers
  intl: ^0.19.0

  # Media (assessment-scanner / visual-aid uploads, voice input)
  image_picker: ^1.1.2
  file_picker: ^8.1.6

  # Diagnostics
  sentry_flutter: ^8.12.0         # mirrors web Sentry ingest

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^6.0.0

  # Code generation
  build_runner: ^2.4.13
  riverpod_generator: ^2.6.3
  go_router_builder: ^2.7.1
  json_serializable: ^6.9.0
  custom_lint: ^0.7.0
  riverpod_lint: ^2.6.3

flutter:
  uses-material-design: true
  generate: true          # enables flutter gen-l10n from l10n.yaml

  assets:
    - assets/images/

  fonts:
    - family: NotoSansDevanagari
      fonts:
        - asset: assets/fonts/NotoSansDevanagari-Regular.ttf
        - asset: assets/fonts/NotoSansDevanagari-Bold.ttf
          weight: 700
    - family: NotoSansBengali
      fonts:
        - asset: assets/fonts/NotoSansBengali-Regular.ttf
        - asset: assets/fonts/NotoSansBengali-Bold.ttf
          weight: 700
    - family: NotoSansKannada
      fonts:
        - asset: assets/fonts/NotoSansKannada-Regular.ttf
        - asset: assets/fonts/NotoSansKannada-Bold.ttf
          weight: 700
    - family: NotoSansTamil
      fonts:
        - asset: assets/fonts/NotoSansTamil-Regular.ttf
        - asset: assets/fonts/NotoSansTamil-Bold.ttf
          weight: 700
    - family: NotoSansTelugu
      fonts:
        - asset: assets/fonts/NotoSansTelugu-Regular.ttf
        - asset: assets/fonts/NotoSansTelugu-Bold.ttf
          weight: 700
    - family: NotoSansGujarati
      fonts:
        - asset: assets/fonts/NotoSansGujarati-Regular.ttf
        - asset: assets/fonts/NotoSansGujarati-Bold.ttf
          weight: 700
    - family: NotoSansGurmukhi
      fonts:
        - asset: assets/fonts/NotoSansGurmukhi-Regular.ttf
        - asset: assets/fonts/NotoSansGurmukhi-Bold.ttf
          weight: 700
    - family: NotoSansMalayalam
      fonts:
        - asset: assets/fonts/NotoSansMalayalam-Regular.ttf
        - asset: assets/fonts/NotoSansMalayalam-Bold.ttf
          weight: 700
    - family: NotoSansOriya
      fonts:
        - asset: assets/fonts/NotoSansOriya-Regular.ttf
        - asset: assets/fonts/NotoSansOriya-Bold.ttf
          weight: 700
```

> Version note: if `flutter pub get` reports a resolver conflict against the exact 3.41.6/3.11.4 SDK constraints, bump the offending package to its nearest newer patch — the caret ranges above are chosen to be the latest known-good line for each package as of the 2026-07 handoff. Do not downgrade `firebase_*` below the listed majors (App Check Play Integrity API depends on them).

---

## 12. Deferred to future versions (explicitly out of v1 scope)

- **Offline mode.** Web app uses Firestore `persistentLocalCache`; the Flutter client is online-only for v1. Future: a `drift`/`isar` cache + request queue behind the repository layer (the `data/` boundary already isolates this — repositories can gain a cache-then-network strategy without touching `presentation`).
- **Push notifications** (`firebase_messaging`) — the `/notifications` screen renders server data over REST in v1.
- **In-app billing** — `/pricing` is read-only; checkout stays on the web (Razorpay flow).
- **Admin / organization / review-panel** surfaces.
- **iOS build** — App Check provider would switch to `AppleProvider.appAttest`; nothing else in this architecture is Android-specific.

---

## 13. Build / codegen quick reference

```bash
flutterfire configure --project=sahayakai-b4248     # firebase_options.dart + google-services.json  (HANDOFF)
flutter pub get
dart run build_runner build --delete-conflicting-outputs   # riverpod + go_router + json_serializable
flutter gen-l10n                                     # AppLocalizations from lib/core/i18n/arb/*.arb
flutter analyze
flutter run                                          # against https://sahayakai.com (prod backend)
```
