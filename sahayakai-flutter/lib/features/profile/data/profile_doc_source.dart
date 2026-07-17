import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_exception.dart';

part 'profile_doc_source.g.dart';

/// Reads and writes the teacher's own `users/<uid>` document.
///
/// WHY A SEAM AND NOT AN `ApiClient` CALL: there is no REST surface for this.
/// Verified across the whole backend:
///   - `/api/user/profile` exposes only `POST` and `PATCH`. There is no `GET`.
///   - The web reads the profile through the `getProfileData` **server action**,
///     which is Next's RSC protocol (a build-specific `Next-Action` id, not a
///     stable HTTP contract) — not callable from a Flutter client.
///   - `/api/auth/profile-check` returns `{exists, onboardingComplete}` only.
///   - `firestore.rules` grants `allow read: if isOwner(userId)` on
///     `users/{userId}`, so the client SDK is the intended read path for a
///     first-party app — which is exactly what this seam becomes.
///
/// BUILT-PENDING-FIREBASE. [FirestoreProfileDocSource] is the real
/// implementation and needs `cloud_firestore` + a signed-in uid, both of which
/// arrive with the P0.2 handoff. Until then [SignedOutProfileDocSource] is
/// bound: it reports "no identity" the same way the network layer would, so the
/// screen shows its sign-in state instead of an invented profile.
abstract class ProfileDocSource {
  /// The document, or null when the teacher has no `users/<uid>` doc yet — a
  /// real and common case, because the production onboarding gate is OFF, so a
  /// teacher can sign in and reach the app before anything is written. Null is
  /// an empty profile, never an error.
  Future<Map<String, dynamic>?> read();

  /// Merges [patch] into the document. Merge, not set: the document holds
  /// server-owned fields (impactScore, badges, planType) this app must never
  /// touch, and `firestore.rules` would reject the write if it tried.
  Future<void> merge(Map<String, dynamic> patch);
}

/// The binding until Firebase lands.
///
/// Throws the same typed 401 the `ApiClient` maps a real unauthorized response
/// to, so every consumer has exactly one auth branch to handle rather than two
/// shapes of "not signed in".
class SignedOutProfileDocSource implements ProfileDocSource {
  const SignedOutProfileDocSource();

  static const ApiException _noIdentity = ApiException(
    ApiErrorKind.unauthorized,
    'Please sign in again.',
    statusCode: 401,
  );

  @override
  Future<Map<String, dynamic>?> read() async => throw _noIdentity;

  @override
  Future<void> merge(Map<String, dynamic> patch) async => throw _noIdentity;
}

/// TODO(P0.2): once `firebase_auth` + `cloud_firestore` are added, replace the
/// binding below with:
///
/// ```dart
/// final uid = ref.watch(firebaseAuthProvider).currentUser?.uid;
/// if (uid == null) return const SignedOutProfileDocSource();
/// return FirestoreProfileDocSource(FirebaseFirestore.instance, uid);
/// ```
///
/// Nothing above this line changes: the DTOs, the repository, the controller
/// and the screen all already speak [ProfileDocSource].
@riverpod
ProfileDocSource profileDocSource(Ref ref) {
  return const SignedOutProfileDocSource();
}
