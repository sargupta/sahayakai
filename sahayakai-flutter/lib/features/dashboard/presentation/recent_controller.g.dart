// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'recent_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$recentItemsControllerHash() =>
    r'd28132328ec7e16451071858dbd1634c800e0f58';

/// Reads the teacher's most recent saved generations for the dashboard.
///
/// `AsyncValue` gives the section its states directly:
///   - `AsyncLoading`               -> the skeleton,
///   - `AsyncError`                 -> offline / sign-in / retry, branched on
///                                     the typed `ApiException` kind,
///   - `AsyncData` with an empty list -> the "nothing saved yet" state,
///   - `AsyncData`                  -> the rows.
///
/// Copied from [RecentItemsController].
@ProviderFor(RecentItemsController)
final recentItemsControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      RecentItemsController,
      List<LibraryItem>
    >.internal(
      RecentItemsController.new,
      name: r'recentItemsControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$recentItemsControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$RecentItemsController = AutoDisposeAsyncNotifier<List<LibraryItem>>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
