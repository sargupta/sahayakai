import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

final firebaseAuthProvider = Provider<FirebaseAuth>((_) => FirebaseAuth.instance);

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.read(firebaseAuthProvider));
});

/// Wraps FirebaseAuth — no dependency on ApiClient to avoid circular deps.
class AuthRepository {
  final FirebaseAuth _auth;

  AuthRepository(this._auth);

  /// Stream that emits on sign-in / sign-out.
  Stream<User?> authStateChanges() => _auth.authStateChanges();

  /// Currently signed-in user (null if signed out).
  User? get currentUser => _auth.currentUser;

  /// Get the Firebase ID token for API calls.
  Future<String?> getIdToken({bool forceRefresh = false}) async {
    return _auth.currentUser?.getIdToken(forceRefresh);
  }

  // --------------- Phone OTP ---------------

  /// Step 1: Send SMS verification code.
  Future<void> verifyPhoneNumber({
    required String phoneNumber,
    required void Function(PhoneAuthCredential) verificationCompleted,
    required void Function(FirebaseAuthException) verificationFailed,
    required void Function(String verificationId, int? resendToken) codeSent,
    required void Function(String verificationId) codeAutoRetrievalTimeout,
    int? forceResendingToken,
  }) async {
    await _auth.verifyPhoneNumber(
      phoneNumber: phoneNumber,
      verificationCompleted: verificationCompleted,
      verificationFailed: verificationFailed,
      codeSent: codeSent,
      codeAutoRetrievalTimeout: codeAutoRetrievalTimeout,
      forceResendingToken: forceResendingToken,
      timeout: const Duration(seconds: 60),
    );
  }

  /// Step 2: Verify OTP and sign in.
  Future<UserCredential> signInWithOtp({
    required String verificationId,
    required String otp,
  }) async {
    final credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: otp,
    );
    return _auth.signInWithCredential(credential);
  }

  /// Sign in with any credential (used for auto-verify on Android).
  Future<UserCredential> signInWithCredential(AuthCredential credential) {
    return _auth.signInWithCredential(credential);
  }

  // --------------- Google Sign-In ---------------

  Future<UserCredential?> signInWithGoogle() async {
    final googleSignIn = GoogleSignIn(
      serverClientId:
          '640589855975-5hskrqgg7k87p6m2ogb9lj19tel78d14.apps.googleusercontent.com',
    );
    final googleUser = await googleSignIn.signIn();
    if (googleUser == null) return null; // User cancelled

    final googleAuth = await googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
      accessToken: googleAuth.accessToken,
      idToken: googleAuth.idToken,
    );
    return _auth.signInWithCredential(credential);
  }

  // --------------- Sign Out ---------------

  Future<void> signOut() async {
    // Clear Google session too so the account picker shows next time.
    try {
      await GoogleSignIn().signOut();
    } catch (_) {}
    await _auth.signOut();
  }
}
