import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/network/api_exception.dart';
import 'profile_dtos.dart';

part 'profile_doc_source.g.dart';

/// Rewrites a merge patch so every [kProfileFieldClear] sentinel becomes the
/// real `FieldValue.delete()` the server honors, leaving every other value
/// untouched. The sentinel keeps [TeacherProfileDocPatch] free of a
/// `cloud_firestore` dependency; this is the one place that speaks Firestore, so
/// the translation lives here. Pure and side-effect-free so it is unit-testable
/// without a Firebase binding.
@visibleForTesting
Map<String, dynamic> applyProfileFieldClears(Map<String, dynamic> patch) {
  return <String, dynamic>{
    for (final entry in patch.entries)
      entry.key: identical(entry.value, kProfileFieldClear)
          ? FieldValue.delete()
          : entry.value,
  };
}

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
/// LIVE (T1-U3). [FirestoreProfileDocSource] is the real implementation,
/// bound whenever a real teacher is signed in; [SignedOutProfileDocSource]
/// is bound otherwise. It reports "no identity" the same way the network
/// layer would, so the screen shows its sign-in state instead of an invented
/// profile.
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

/// The real binding once Firebase is live for a signed-in teacher: reads and
/// merges `users/<uid>` directly via the client SDK. Matches
/// `firestore.rules`'s `match /users/{userId}` block — `allow read` /
/// `allow update` / `allow create` are all gated on `isOwner(userId)`
/// (`request.auth.uid == userId`), so [_uid] must be exactly the signed-in
/// Firebase uid, never a client-supplied value.
class FirestoreProfileDocSource implements ProfileDocSource {
  const FirestoreProfileDocSource(this._firestore, this._uid);

  final FirebaseFirestore _firestore;
  final String _uid;

  DocumentReference<Map<String, dynamic>> get _doc =>
      _firestore.collection('users').doc(_uid);

  @override
  Future<Map<String, dynamic>?> read() async {
    final snapshot = await _doc.get();
    return snapshot.data();
  }

  /// A merge-set, never a plain `set`: `firestore.rules`'s `isSafeUserUpdate()`
  /// rejects any write that touches a protected field (`impactScore`,
  /// `badges`, `planType`, role/billing/org fields — the full list is
  /// `protectedUserFields()` in `firestore.rules`), and `SetOptions(merge:
  /// true)` only ever touches the keys [patch] actually names — this app's
  /// writes are always partial (Settings patches one slice, onboarding
  /// completion another). The rules key `create` vs. `update` off whether the
  /// document already exists, not off the SDK call used, so this same merge
  /// call both creates the doc on a teacher's first save (subject to the
  /// rules' `create` branch, which forbids seeding privileged fields) and
  /// updates it afterwards — no separate create/update branch is needed here.
  @override
  Future<void> merge(Map<String, dynamic> patch) =>
      _doc.set(applyProfileFieldClears(patch), SetOptions(merge: true));
}

/// [FirestoreProfileDocSource] once a real teacher is signed in,
/// [SignedOutProfileDocSource] otherwise. Reactive on [authControllerProvider]
/// (`core/auth/auth_providers.dart`) — the single source of truth the router
/// and the token exchange already agree on — rather than reading
/// `FirebaseAuth.instance.currentUser` once at build time, so a real
/// sign-in/sign-out flips this binding the same beat the rest of the app
/// reacts to it.
///
/// Nothing below this line changes when this binding flips: the DTOs, the
/// repository, the controller and the screen all already speak
/// [ProfileDocSource].
@riverpod
ProfileDocSource profileDocSource(Ref ref) {
  final status = ref.watch(authControllerProvider);
  if (status != AuthStatus.signedIn) return const SignedOutProfileDocSource();
  final uid = FirebaseAuth.instance.currentUser?.uid;
  if (uid == null) return const SignedOutProfileDocSource();
  return FirestoreProfileDocSource(FirebaseFirestore.instance, uid);
}
