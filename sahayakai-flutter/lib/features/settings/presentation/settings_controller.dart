import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/firebase/firebase_init.dart';
import '../../../core/network/api_exception.dart';
import '../../profile/data/profile_repository.dart';
import '../../profile/presentation/profile_controller.dart';
import '../../profile/domain/profile_settings.dart';
import '../data/settings_repository.dart';
import '../domain/account_deletion.dart';

part 'settings_controller.g.dart';

/// Drives the "Save profile" action through `AsyncValue<void>`:
///   - `AsyncData(null)` -> idle (initial, and after a successful save),
///   - `AsyncLoading`    -> the button shows a spinner and is not re-tappable,
///   - `AsyncError`      -> the typed `ApiException` the view maps to copy.
///
/// There is no `build()` fetch here, and there still must not be: `users/<uid>`
/// has ONE reader, `profileControllerProvider`, and a second would give the same
/// document two cache lifetimes. Settings does not fork that read — it WATCHES
/// it, which is how its form hydrates.
///
/// The write goes through `ProfileRepository` for the same reason — Settings
/// edits a slice of a document it does not own, so it borrows that feature's
/// gateway (and its verified `preferredBoard` mapping) instead of keeping a
/// parallel one — and then hands the saved slice back to that one reader, so
/// the Profile tab does not sit on a pre-save value.
@riverpod
class ProfileSaveController extends _$ProfileSaveController {
  @override
  FutureOr<void> build() {}

  /// Returns true when the save succeeded, so the view can show its
  /// confirmation without duplicating the state check.
  Future<bool> save(ProfileSettings settings) async {
    state = const AsyncValue<void>.loading();
    final next = await AsyncValue.guard<void>(
      () => ref.read(profileRepositoryProvider).savePatchableSlice(settings),
    );
    state = next;
    if (!next.hasError) {
      // The document now matches what was sent, so the one reader adopts it
      // rather than leaving Profile showing the pre-save values.
      ref.read(profileControllerProvider.notifier).applySavedSlice(settings);
    }
    return !next.hasError;
  }
}

/// Drives account deletion through `AsyncValue<AccountDeletion?>`:
///   - `AsyncData(null)`      -> nothing attempted,
///   - `AsyncLoading`         -> in flight,
///   - `AsyncError`           -> typed `ApiException`; a 401 here means
///                               "re-authenticate", which is a first-class
///                               state, not a generic failure,
///   - `AsyncData(deletion)`  -> scheduled, with the grace window.
@riverpod
class DeleteAccountController extends _$DeleteAccountController {
  @override
  FutureOr<AccountDeletion?> build() => null;

  static const _reauthRequired = ApiException(
    ApiErrorKind.unauthorized,
    'reauth_required',
    statusCode: 401,
  );

  /// Only ever called once the typed-confirmation interlock has passed; see
  /// [isDeleteConfirmed].
  ///
  /// The route demands the ID token's `auth_time` be within 5 minutes — a
  /// plain `getIdToken(forceRefresh: true)` mints a new TOKEN but preserves
  /// the ORIGINAL `auth_time` claim, so a teacher signed in this morning
  /// would still be rejected (HANDOFF.md §2). The real fix is
  /// `reauthenticateWithCredential`: re-running the Google picker right here,
  /// which is the only way to actually mint a fresh `auth_time`.
  Future<void> confirmDelete() async {
    state = const AsyncValue<AccountDeletion?>.loading();
    state = await AsyncValue.guard<AccountDeletion?>(() async {
      if (!FirebaseInit.isConfigured) throw _reauthRequired;
      final user = FirebaseAuth.instance.currentUser;
      if (user == null) throw _reauthRequired;

      final googleUser = await ref.read(googleSignInProvider).signIn();
      if (googleUser == null) {
        // The teacher dismissed the re-auth picker — same first-class
        // "sign in again" state as any other reauth failure, not an error.
        throw _reauthRequired;
      }
      final googleAuth = await googleUser.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );
      await user.reauthenticateWithCredential(credential);

      final token = await user.getIdToken(true);
      if (token == null || token.isEmpty) throw _reauthRequired;
      return ref
          .read(settingsRepositoryProvider)
          .deleteAccount(idToken: token);
    });
  }
}
