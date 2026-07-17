import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/network/api_providers.dart';
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

  /// Only ever called once the typed-confirmation interlock has passed; see
  /// [isDeleteConfirmed].
  Future<void> confirmDelete() async {
    state = const AsyncValue<AccountDeletion?>.loading();
    state = await AsyncValue.guard<AccountDeletion?>(() async {
      // The route re-verifies this token itself and demands an `auth_time`
      // within 5 minutes.
      //
      // BUILT-PENDING-FIREBASE. `tokenProvider` is the foundation-v1 stub and
      // always returns null, so this throws the re-auth exception below every
      // time and the screen shows the "please sign in again" state. That is the
      // correct, honest behaviour for a signed-out client.
      //
      // TODO(P0.2): `forceRefresh: true` is NOT sufficient once Firebase lands.
      // It mints a new token but preserves the ORIGINAL `auth_time` claim, so a
      // teacher signed in this morning would still be rejected. The real flow
      // must call `user.reauthenticateWithCredential(...)` (re-running the
      // Google sign-in) and pass THAT result's token here.
      final token =
          await ref.read(tokenProviderProvider)(forceRefresh: true);
      if (token == null || token.isEmpty) {
        throw const ApiException(
          ApiErrorKind.unauthorized,
          'reauth_required',
          statusCode: 401,
        );
      }
      return ref
          .read(settingsRepositoryProvider)
          .deleteAccount(idToken: token);
    });
  }
}
