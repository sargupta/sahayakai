// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'settings_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$profileSaveControllerHash() =>
    r'61384e28d41f5278f6c204fe711aa3b3b6be9df7';

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
    r'3f2aebd2ebac4244fa9fbef423eacacf90e24c35';

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
String _$exportDataControllerHash() =>
    r'08f85216c625842be049a8d8f13a8fc42a2c5033';

/// Drives `POST /api/export` through `AsyncValue<ExportResult?>`:
///   - `AsyncData(null)`   -> nothing attempted yet,
///   - `AsyncLoading`      -> in flight (the export button shows a spinner),
///   - `AsyncError`        -> typed `ApiException`,
///   - `AsyncData(result)` -> either the real archive bytes ready to hand to
///     the OS share sheet, or an honest "this got queued" notice — see
///     [ExportResult].
///
/// This replaces the previous `linkOpenerProvider` approach (opening
/// `exportUrl` in the external system browser), which 401ed for essentially
/// every teacher: a mobile app's external browser tab carries neither the
/// Bearer token this route's middleware requires nor the web-only session
/// cookie it also accepts. Going through [SettingsRepository] means this
/// request rides the SAME authenticated [ApiClient] every other screen uses.
///
/// Copied from [ExportDataController].
@ProviderFor(ExportDataController)
final exportDataControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      ExportDataController,
      ExportResult?
    >.internal(
      ExportDataController.new,
      name: r'exportDataControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$exportDataControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$ExportDataController = AutoDisposeAsyncNotifier<ExportResult?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
