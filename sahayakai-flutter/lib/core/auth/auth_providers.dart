import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../firebase/firebase_init.dart';

part 'auth_providers.g.dart';

/// Coarse auth state — the router redirect guard and every "am I signed in"
/// UI read this. Backed by real `firebase_auth` (see [AuthController]).
enum AuthStatus { signedOut, signedIn }

/// The shared [GoogleSignIn] instance. A provider (not a bare singleton) so a
/// test can override it with a fake and never touch a real Google account —
/// `google_sign_in`'s own platform channel throws in the widget-test
/// environment if invoked for real.
@Riverpod(keepAlive: true)
GoogleSignIn googleSignIn(Ref ref) => GoogleSignIn(scopes: const ['email']);

/// The real auth controller. State mirrors `FirebaseAuth.instance
/// .authStateChanges()` — the single source of truth both the router and the
/// backend token exchange ([tokenProvider] in `core/network/api_providers.dart`)
/// agree on, which is what makes them consistent (the foundation-v1 stub had
/// two independent flags — a local one here, a real-backend one from VIDYA's
/// own 401 — that could disagree; that inconsistency was the actual cause of
/// a "Sign in" button silently bouncing back to Home instead of navigating,
/// fixed by removing the stub rather than working around it).
@Riverpod(keepAlive: true)
class AuthController extends _$AuthController {
  StreamSubscription<User?>? _sub;

  @override
  AuthStatus build() {
    // Guard on the SAME seam Block C already uses. `main()` awaits
    // `FirebaseInit.ensureInitialized()` before `runApp`, so this is `true`
    // in a real launch by the time anything reads auth state — but a widget
    // test never runs `main()`, and a real device where init itself failed
    // (corrupt config, no Play Services) must not crash every screen that
    // reads this provider. `FirebaseAuth.instance` throws
    // `[core/no-app]` with no default app registered, so it must never be
    // touched unless [FirebaseInit.isConfigured] is true.
    if (!FirebaseInit.isConfigured) return AuthStatus.signedOut;
    _sub = FirebaseAuth.instance.authStateChanges().listen((user) {
      state = user != null ? AuthStatus.signedIn : AuthStatus.signedOut;
    });
    ref.onDispose(() => _sub?.cancel());
    return FirebaseAuth.instance.currentUser != null
        ? AuthStatus.signedIn
        : AuthStatus.signedOut;
  }

  /// Runs the real Google Sign-In → Firebase credential exchange used by the
  /// login screen's CTA. Returns `false` when Firebase isn't configured, or
  /// when the teacher dismisses the account picker (a normal choice, not a
  /// failure — the caller should not show an error either way) and rethrows
  /// any real [FirebaseAuthException] so the caller can surface it.
  Future<bool> signIn() async {
    if (!FirebaseInit.isConfigured) return false;
    final googleUser = await ref.read(googleSignInProvider).signIn();
    if (googleUser == null) return false;
    final googleAuth = await googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
    await FirebaseAuth.instance.signInWithCredential(credential);
    // authStateChanges (above) flips `state`; no need to set it here too.
    return true;
  }

  Future<void> signOut() async {
    if (!FirebaseInit.isConfigured) return;
    await ref.read(googleSignInProvider).signOut();
    await FirebaseAuth.instance.signOut();
  }
}

/// Convenience sync snapshot: is a user currently signed in.
@riverpod
bool isSignedIn(Ref ref) =>
    ref.watch(authControllerProvider) == AuthStatus.signedIn;

/// First-run bootstrap: `main()` already awaited `FirebaseInit
/// .ensureInitialized()` before `runApp`, so by the time this provider builds
/// Firebase is already up — this is a deliberate minimum splash dwell (a
/// beat to read the brand mark), not a simulation of anything still pending.
/// While this future is loading, the router parks on /splash.
@Riverpod(keepAlive: true)
Future<void> appBootstrap(Ref ref) async {
  await Future<void>.delayed(const Duration(milliseconds: 600));
}
