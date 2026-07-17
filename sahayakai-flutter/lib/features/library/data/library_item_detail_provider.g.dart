// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'library_item_detail_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$libraryItemDetailHash() => r'c311af612582beb46ee4a84e63cb1b653a7eebf4';

/// Copied from Dart SDK
class _SystemHash {
  _SystemHash._();

  static int combine(int hash, int value) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + value);
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x0007ffff & hash) << 10));
    return hash ^ (hash >> 6);
  }

  static int finish(int hash) {
    // ignore: parameter_assignments
    hash = 0x1fffffff & (hash + ((0x03ffffff & hash) << 3));
    // ignore: parameter_assignments
    hash = hash ^ (hash >> 11);
    return 0x1fffffff & (hash + ((0x00003fff & hash) << 15));
  }
}

/// The per-item read behind tap-to-open, keyed by content id.
///
/// Separate from `libraryItemsProvider` (the ONE shared list read the dashboard
/// and the Library tab share) on purpose: this fetches a SINGLE document off
/// `GET /api/content/get?id=<id>`, only when a row is actually tapped, so it
/// never disturbs the list's single-request invariant.
///
/// It exposes an `AsyncValue<LibraryItem>` so `LibraryDetailScreen` gets its
/// states directly — loading -> skeleton, error -> signed-in / offline / gone /
/// retry (branched on the typed `ApiException`), data -> the opened item. On
/// today's stub auth it 401s (BUILT-PENDING-FIREBASE), which the detail screen
/// renders as the "sign in to open" state.
///
/// Copied from [libraryItemDetail].
@ProviderFor(libraryItemDetail)
const libraryItemDetailProvider = LibraryItemDetailFamily();

/// The per-item read behind tap-to-open, keyed by content id.
///
/// Separate from `libraryItemsProvider` (the ONE shared list read the dashboard
/// and the Library tab share) on purpose: this fetches a SINGLE document off
/// `GET /api/content/get?id=<id>`, only when a row is actually tapped, so it
/// never disturbs the list's single-request invariant.
///
/// It exposes an `AsyncValue<LibraryItem>` so `LibraryDetailScreen` gets its
/// states directly — loading -> skeleton, error -> signed-in / offline / gone /
/// retry (branched on the typed `ApiException`), data -> the opened item. On
/// today's stub auth it 401s (BUILT-PENDING-FIREBASE), which the detail screen
/// renders as the "sign in to open" state.
///
/// Copied from [libraryItemDetail].
class LibraryItemDetailFamily extends Family<AsyncValue<LibraryItem>> {
  /// The per-item read behind tap-to-open, keyed by content id.
  ///
  /// Separate from `libraryItemsProvider` (the ONE shared list read the dashboard
  /// and the Library tab share) on purpose: this fetches a SINGLE document off
  /// `GET /api/content/get?id=<id>`, only when a row is actually tapped, so it
  /// never disturbs the list's single-request invariant.
  ///
  /// It exposes an `AsyncValue<LibraryItem>` so `LibraryDetailScreen` gets its
  /// states directly — loading -> skeleton, error -> signed-in / offline / gone /
  /// retry (branched on the typed `ApiException`), data -> the opened item. On
  /// today's stub auth it 401s (BUILT-PENDING-FIREBASE), which the detail screen
  /// renders as the "sign in to open" state.
  ///
  /// Copied from [libraryItemDetail].
  const LibraryItemDetailFamily();

  /// The per-item read behind tap-to-open, keyed by content id.
  ///
  /// Separate from `libraryItemsProvider` (the ONE shared list read the dashboard
  /// and the Library tab share) on purpose: this fetches a SINGLE document off
  /// `GET /api/content/get?id=<id>`, only when a row is actually tapped, so it
  /// never disturbs the list's single-request invariant.
  ///
  /// It exposes an `AsyncValue<LibraryItem>` so `LibraryDetailScreen` gets its
  /// states directly — loading -> skeleton, error -> signed-in / offline / gone /
  /// retry (branched on the typed `ApiException`), data -> the opened item. On
  /// today's stub auth it 401s (BUILT-PENDING-FIREBASE), which the detail screen
  /// renders as the "sign in to open" state.
  ///
  /// Copied from [libraryItemDetail].
  LibraryItemDetailProvider call(String id) {
    return LibraryItemDetailProvider(id);
  }

  @override
  LibraryItemDetailProvider getProviderOverride(
    covariant LibraryItemDetailProvider provider,
  ) {
    return call(provider.id);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'libraryItemDetailProvider';
}

/// The per-item read behind tap-to-open, keyed by content id.
///
/// Separate from `libraryItemsProvider` (the ONE shared list read the dashboard
/// and the Library tab share) on purpose: this fetches a SINGLE document off
/// `GET /api/content/get?id=<id>`, only when a row is actually tapped, so it
/// never disturbs the list's single-request invariant.
///
/// It exposes an `AsyncValue<LibraryItem>` so `LibraryDetailScreen` gets its
/// states directly — loading -> skeleton, error -> signed-in / offline / gone /
/// retry (branched on the typed `ApiException`), data -> the opened item. On
/// today's stub auth it 401s (BUILT-PENDING-FIREBASE), which the detail screen
/// renders as the "sign in to open" state.
///
/// Copied from [libraryItemDetail].
class LibraryItemDetailProvider extends AutoDisposeFutureProvider<LibraryItem> {
  /// The per-item read behind tap-to-open, keyed by content id.
  ///
  /// Separate from `libraryItemsProvider` (the ONE shared list read the dashboard
  /// and the Library tab share) on purpose: this fetches a SINGLE document off
  /// `GET /api/content/get?id=<id>`, only when a row is actually tapped, so it
  /// never disturbs the list's single-request invariant.
  ///
  /// It exposes an `AsyncValue<LibraryItem>` so `LibraryDetailScreen` gets its
  /// states directly — loading -> skeleton, error -> signed-in / offline / gone /
  /// retry (branched on the typed `ApiException`), data -> the opened item. On
  /// today's stub auth it 401s (BUILT-PENDING-FIREBASE), which the detail screen
  /// renders as the "sign in to open" state.
  ///
  /// Copied from [libraryItemDetail].
  LibraryItemDetailProvider(String id)
    : this._internal(
        (ref) => libraryItemDetail(ref as LibraryItemDetailRef, id),
        from: libraryItemDetailProvider,
        name: r'libraryItemDetailProvider',
        debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
            ? null
            : _$libraryItemDetailHash,
        dependencies: LibraryItemDetailFamily._dependencies,
        allTransitiveDependencies:
            LibraryItemDetailFamily._allTransitiveDependencies,
        id: id,
      );

  LibraryItemDetailProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.id,
  }) : super.internal();

  final String id;

  @override
  Override overrideWith(
    FutureOr<LibraryItem> Function(LibraryItemDetailRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: LibraryItemDetailProvider._internal(
        (ref) => create(ref as LibraryItemDetailRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        id: id,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<LibraryItem> createElement() {
    return _LibraryItemDetailProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is LibraryItemDetailProvider && other.id == id;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, id.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin LibraryItemDetailRef on AutoDisposeFutureProviderRef<LibraryItem> {
  /// The parameter `id` of this provider.
  String get id;
}

class _LibraryItemDetailProviderElement
    extends AutoDisposeFutureProviderElement<LibraryItem>
    with LibraryItemDetailRef {
  _LibraryItemDetailProviderElement(super.provider);

  @override
  String get id => (origin as LibraryItemDetailProvider).id;
}

// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
