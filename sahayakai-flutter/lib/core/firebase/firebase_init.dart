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

  /// Whether `Firebase.initializeApp()` has completed for this process.
  static bool get isConfigured => _ready;

  /// Idempotent; safe to `await` in `main()` on every launch. Swallows
  /// failure (a missing/corrupt `google-services.json`, no Google Play
  /// services on the device) rather than crashing app boot — [isConfigured]
  /// simply stays `false` and every Firebase-gated surface keeps rendering
  /// its existing deferred/signed-out state, which is always a safe fallback.
  static Future<void> ensureInitialized() async {
    if (_ready) return;
    try {
      await Firebase.initializeApp();
      _ready = true;
    } catch (_) {
      _ready = false;
    }
  }
}
