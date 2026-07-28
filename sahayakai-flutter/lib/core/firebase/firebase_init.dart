import 'package:firebase_core/firebase_core.dart';

/// # Firebase init (real, since the auth handoff)
///
/// `firebase_core` + `firebase_auth` + `google_sign_in` are now in
/// `pubspec.yaml`, `android/app/google-services.json` carries the real
/// SahayakAI project config, and the `com.google.gms.google-services` Gradle
/// plugin is applied — so `Firebase.initializeApp()` reads the Android app's
/// native config directly (no `firebase_options.dart` / `flutterfire
/// configure` needed for an Android-only build; that generated file is only
/// required to pick a platform-specific `FirebaseOptions` when a project
/// targets more than one platform).
///
/// [isConfigured] still exists as the seam the Block-C transport providers
/// read to choose "deferred vs. live" — it now reflects whether `initializeApp`
/// actually completed, since a stale/misconfigured `google-services.json`
/// should degrade to the deferred transports rather than crash the app.
///
/// A real init failure is no longer *silently* swallowed: [initError] records
/// it so [appBootstrap] can surface a first-class failure state on the splash
/// (with a retry), instead of letting the teacher fall through to a dead Login
/// button while the already-built retry screen stays unreachable.
///
/// **What this file does NOT do**: `cloud_firestore` / `firebase_database` /
/// `firebase_messaging` are still absent — those back the Block-C *live reads*
/// (inbox/staffroom/chat/presence/FCM), a separate handoff from auth. Auth
/// alone does not make those providers live; see each transport's own
/// `Deferred*Transport` for that seam. `firebase_app_check` is also
/// deliberately still absent — HANDOFF.md is explicit that App Check must
/// land in monitor/soft-enforce, verified, before hard-enforcing, and that is
/// a founder-side call on the Play Integrity console, not a default to wire
/// blind.
class FirebaseInit {
  const FirebaseInit._();

  static bool _ready = false;
  static Object? _initError;

  /// Whether `Firebase.initializeApp()` has completed for this process.
  static bool get isConfigured => _ready;

  /// The error from the most recent [ensureInitialized] attempt that failed, or
  /// `null` when init succeeded or was never attempted. This is the honest,
  /// exposed record of a REAL init failure — the rural 2G / App Check handshake
  /// lost, a corrupt `google-services.json`, no Google Play services — that
  /// replaces the old swallowed `catch (_)`. [appBootstrap] reads it to surface
  /// the failure as a first-class error state on the splash (with a retry),
  /// rather than the teacher silently landing on a dead Login button.
  static Object? get initError => _initError;

  /// Idempotent; safe to `await` in `main()` on every launch. A failure (a
  /// missing/corrupt `google-services.json`, no Google Play services, a lost
  /// handshake on a weak network) does NOT crash app boot — this still returns
  /// normally so `main()` reaches `runApp` — but it is now RECORDED in
  /// [initError] instead of being dropped. The transport seams keep reading
  /// [isConfigured] (still `false` on failure) to degrade to their deferred
  /// path; the splash reads [initError] to offer a retry. A retry re-runs this
  /// (a prior failure left [_ready] `false`, so it re-attempts `initializeApp`).
  static Future<void> ensureInitialized() async {
    if (_ready) return;
    try {
      await Firebase.initializeApp();
      _ready = true;
      _initError = null;
    } catch (error) {
      _ready = false;
      _initError = error;
    }
  }
}

/// Wraps the underlying error from a failed [FirebaseInit.ensureInitialized] so
/// [appBootstrap] can surface init failure as a typed [AsyncError] the splash's
/// retry screen renders. The raw [cause] is kept for logs and diagnostics; it
/// is never shown to the teacher (the splash prints its own localized copy).
class FirebaseInitException implements Exception {
  const FirebaseInitException(this.cause);

  final Object cause;

  @override
  String toString() => 'FirebaseInitException: $cause';
}
