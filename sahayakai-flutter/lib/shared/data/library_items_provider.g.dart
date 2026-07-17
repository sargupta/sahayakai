// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'library_items_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$libraryItemsHash() => r'585d8594516b9cf6e44fd92e2c3a55e5f0c7b8a1';

/// The teacher's saved generations — the ONE read of `GET /api/content/list`,
/// shared by the dashboard's Recent section and the Library tab.
///
/// Both surfaces show the same server-ordered list, so they share one provider
/// rather than each owning a fetch. That matters more than it looks: `AppShell`
/// puts every tab in an `IndexedStack`, which builds all of them at startup, so
/// two controllers would mean two near-identical requests on launch — on a rural
/// connection, twice the wait for the same rows. Instead the Library tab is
/// already warm by the time it is opened, and a retry on either surface fixes
/// both.
///
/// It fetches [LibraryRepository.maxLimit] (the most the route will accept) and
/// lets the dashboard cap its own display, because the dashboard's "5" is a
/// presentation choice, not a different query.
///
/// PAGINATION IS NOT WIRED. This is the newest 20 and there is no "load more":
/// the repository takes a limit and no cursor. A teacher with more than 20 saved
/// items sees their newest 20 — which is honest, and the Library screen says so
/// rather than implying it is the complete archive.
///
/// `AsyncValue` gives both surfaces their states directly:
///   - `AsyncLoading`                 -> the skeleton,
///   - `AsyncError`                   -> offline / sign-in / retry, branched on
///                                       the typed `ApiException` kind,
///   - `AsyncData` with an empty list -> the "nothing saved yet" state,
///   - `AsyncData`                    -> the rows.
///
/// Copied from [LibraryItems].
@ProviderFor(LibraryItems)
final libraryItemsProvider =
    AutoDisposeAsyncNotifierProvider<LibraryItems, List<LibraryItem>>.internal(
      LibraryItems.new,
      name: r'libraryItemsProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$libraryItemsHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$LibraryItems = AutoDisposeAsyncNotifier<List<LibraryItem>>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
