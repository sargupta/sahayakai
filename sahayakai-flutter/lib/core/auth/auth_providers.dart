import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'auth_providers.g.dart';

/// Coarse auth state for foundation-v1.
enum AuthStatus { signedOut, signedIn }

/// STUB auth controller. The router redirect guard and the "am I signed in"
/// UI read this. Real Firebase auth lands in the NEXT unit (P0.2), which is
/// handoff-gated (needs `flutterfire configure` against the Firebase console).
///
/// TODO(P0.2): replace this with a Firebase-backed provider, e.g.
/// `@Riverpod(keepAlive: true) Stream<User?> authState(Ref ref) =>`
/// `ref.watch(firebaseAuthProvider).authStateChanges();`
@Riverpod(keepAlive: true)
class AuthController extends _$AuthController {
  @override
  AuthStatus build() => AuthStatus.signedOut;

  /// Placeholder sign-in used by the login screen's "Continue" button.
  /// TODO(P0.2): swap for Google sign-in via signInWithCredential.
  void signIn() => state = AuthStatus.signedIn;

  /// TODO(P0.2): GoogleSignIn().signOut() + FirebaseAuth.instance.signOut().
  void signOut() => state = AuthStatus.signedOut;
}

/// Convenience sync snapshot: is a user currently signed in.
@riverpod
bool isSignedIn(Ref ref) =>
    ref.watch(authControllerProvider) == AuthStatus.signedIn;

/// Simulates first-run bootstrap (what will become Firebase.initializeApp +
/// FirebaseAppCheck.activate + the first auth snapshot). While this future is
/// loading, the router parks on /splash.
///
/// TODO(P0.2): perform the real Firebase init + App Check activation here.
@Riverpod(keepAlive: true)
Future<void> appBootstrap(Ref ref) async {
  await Future<void>.delayed(const Duration(milliseconds: 600));
}
