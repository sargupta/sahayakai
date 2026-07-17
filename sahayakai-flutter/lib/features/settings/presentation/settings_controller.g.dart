// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'settings_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$profileSaveControllerHash() =>
    r'988de9ec37fdfa7f0ab634209381b9c7af4ac6cb';

/// Drives the "Save profile" action through `AsyncValue<void>`:
///   - `AsyncData(null)` -> idle (initial, and after a successful save),
///   - `AsyncLoading`    -> the button shows a spinner and is not re-tappable,
///   - `AsyncError`      -> the typed `ApiException` the view maps to copy.
///
/// There is no `build()` fetch: Settings does not read the profile doc. The
/// read lives in P0.8 (Profile), which owns `users/<uid>`, and duplicating it
/// here would give the same document two readers with two cache lifetimes.
///
/// The write goes through `ProfileRepository` for the same reason — Settings
/// edits a slice of a document it does not own, so it borrows that feature's
/// gateway (and its verified `preferredBoard` mapping) instead of keeping a
/// parallel one.
///
/// Copied from [ProfileSaveController].
@ProviderFor(ProfileSaveController)
final profileSaveControllerProvider =
    AutoDisposeAsyncNotifierProvider<ProfileSaveController, void>.internal(
      ProfileSaveController.new,
      name: r'profileSaveControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$profileSaveControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$ProfileSaveController = AutoDisposeAsyncNotifier<void>;
String _$deleteAccountControllerHash() =>
    r'd30fca50bce4335b71110f07276be342db217610';

/// Drives account deletion through `AsyncValue<AccountDeletion?>`:
///   - `AsyncData(null)`      -> nothing attempted,
///   - `AsyncLoading`         -> in flight,
///   - `AsyncError`           -> typed `ApiException`; a 401 here means
///                               "re-authenticate", which is a first-class
///                               state, not a generic failure,
///   - `AsyncData(deletion)`  -> scheduled, with the grace window.
///
/// Copied from [DeleteAccountController].
@ProviderFor(DeleteAccountController)
final deleteAccountControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      DeleteAccountController,
      AccountDeletion?
    >.internal(
      DeleteAccountController.new,
      name: r'deleteAccountControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$deleteAccountControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$DeleteAccountController = AutoDisposeAsyncNotifier<AccountDeletion?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
