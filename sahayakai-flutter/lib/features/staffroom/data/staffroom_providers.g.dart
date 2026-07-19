// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'staffroom_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$unifiedFeedHash() => r'349101da4fe368923d997330a1b2747741bd82d9';

/// # Staffroom read providers (U-SI2)
///
/// Thin Riverpod wrappers over the [StaffroomTransport] server-derived reads
/// (SPEC §A2 / §A3). Unlike the Pro Inbox's live `onSnapshot` surfaces, the
/// Staffroom feed + groups + recommendations are **one-shot server reads** (the
/// web polls them on focus + every 45s), so these are `FutureProvider`s, not
/// `StreamProvider`s.
///
/// While Firebase is gated the bound transport is [DeferredStaffroomTransport],
/// so every read resolves to an empty list / null (a genuinely-empty "ready"
/// value, NOT a typed snapshot). The Staffroom home therefore reads its
/// signed-out / awaiting surface off [currentStaffroomUserId] (null on-device),
/// exactly the way the inbox reads it off `currentInboxUserId` — a `null` uid
/// means "sign in to join the staffroom" regardless of what the (empty) reads
/// return. Widget tests override the transport with a seeded fake **and**
/// [currentStaffroomUserId] with a fixed uid to exercise ready / empty / data,
/// and override the feed/posts providers directly with a pending / error future
/// to exercise the loading / error surfaces.
/// **ONE-SHOT.** The unified feed (`getUnifiedFeedAction`) — the primary surface
/// whose [AsyncValue] drives the Staffroom home's loading / error / ready state.
///
/// Copied from [unifiedFeed].
@ProviderFor(unifiedFeed)
final unifiedFeedProvider = AutoDisposeFutureProvider<List<FeedItem>>.internal(
  unifiedFeed,
  name: r'unifiedFeedProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$unifiedFeedHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef UnifiedFeedRef = AutoDisposeFutureProviderRef<List<FeedItem>>;
String _$myGroupsHash() => r'28c9441026aee8c9f3dd57a7e1828c2555973042';

/// **ONE-SHOT.** The teacher's own groups (`getMyGroupsAction`) — the "Your
/// groups" strip, and the source of truth for whether a group is already joined.
///
/// Copied from [myGroups].
@ProviderFor(myGroups)
final myGroupsProvider = AutoDisposeFutureProvider<List<Group>>.internal(
  myGroups,
  name: r'myGroupsProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$myGroupsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef MyGroupsRef = AutoDisposeFutureProviderRef<List<Group>>;
String _$discoverGroupsHash() => r'd47c1582274f102b434be1531b6319a2f51bd4ad';

/// **ONE-SHOT.** Suggested, not-yet-joined groups (`discoverGroupsAction`) — the
/// "Discover groups" section.
///
/// Copied from [discoverGroups].
@ProviderFor(discoverGroups)
final discoverGroupsProvider = AutoDisposeFutureProvider<List<Group>>.internal(
  discoverGroups,
  name: r'discoverGroupsProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$discoverGroupsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef DiscoverGroupsRef = AutoDisposeFutureProviderRef<List<Group>>;
String _$recommendedTeachersHash() =>
    r'87689ddf79b6e1cefd823b0fbc15bd6d7cd0d2d8';

/// **ONE-SHOT.** "People you may know" (`getRecommendedTeachersAction`, ≤5).
///
/// Copied from [recommendedTeachers].
@ProviderFor(recommendedTeachers)
final recommendedTeachersProvider =
    AutoDisposeFutureProvider<List<TeacherSuggestion>>.internal(
      recommendedTeachers,
      name: r'recommendedTeachersProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$recommendedTeachersHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef RecommendedTeachersRef =
    AutoDisposeFutureProviderRef<List<TeacherSuggestion>>;
String _$likedItemIdsHash() => r'4ace777c11bc7385844587e838b107d6db52b50f';

/// **ONE-SHOT.** The ids the current user has already liked
/// (`getLikedItemIdsAction`) — hydrates filled hearts on mount. Defaults to an
/// empty [LikedItemIds] while it resolves, so a post card renders an outline
/// heart first and fills it once this arrives.
///
/// Copied from [likedItemIds].
@ProviderFor(likedItemIds)
final likedItemIdsProvider = AutoDisposeFutureProvider<LikedItemIds>.internal(
  likedItemIds,
  name: r'likedItemIdsProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$likedItemIdsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef LikedItemIdsRef = AutoDisposeFutureProviderRef<LikedItemIds>;
String _$staffroomGroupHash() => r'adb664e6ca06dfa144a15cb24ba77c2ed82d597c';

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

/// **ONE-SHOT.family.** One group's metadata (`getGroupAction`) — the group
/// detail header. `null` → the group was not found / removed.
///
/// Copied from [staffroomGroup].
@ProviderFor(staffroomGroup)
const staffroomGroupProvider = StaffroomGroupFamily();

/// **ONE-SHOT.family.** One group's metadata (`getGroupAction`) — the group
/// detail header. `null` → the group was not found / removed.
///
/// Copied from [staffroomGroup].
class StaffroomGroupFamily extends Family<AsyncValue<Group?>> {
  /// **ONE-SHOT.family.** One group's metadata (`getGroupAction`) — the group
  /// detail header. `null` → the group was not found / removed.
  ///
  /// Copied from [staffroomGroup].
  const StaffroomGroupFamily();

  /// **ONE-SHOT.family.** One group's metadata (`getGroupAction`) — the group
  /// detail header. `null` → the group was not found / removed.
  ///
  /// Copied from [staffroomGroup].
  StaffroomGroupProvider call(String groupId) {
    return StaffroomGroupProvider(groupId);
  }

  @override
  StaffroomGroupProvider getProviderOverride(
    covariant StaffroomGroupProvider provider,
  ) {
    return call(provider.groupId);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'staffroomGroupProvider';
}

/// **ONE-SHOT.family.** One group's metadata (`getGroupAction`) — the group
/// detail header. `null` → the group was not found / removed.
///
/// Copied from [staffroomGroup].
class StaffroomGroupProvider extends AutoDisposeFutureProvider<Group?> {
  /// **ONE-SHOT.family.** One group's metadata (`getGroupAction`) — the group
  /// detail header. `null` → the group was not found / removed.
  ///
  /// Copied from [staffroomGroup].
  StaffroomGroupProvider(String groupId)
    : this._internal(
        (ref) => staffroomGroup(ref as StaffroomGroupRef, groupId),
        from: staffroomGroupProvider,
        name: r'staffroomGroupProvider',
        debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
            ? null
            : _$staffroomGroupHash,
        dependencies: StaffroomGroupFamily._dependencies,
        allTransitiveDependencies:
            StaffroomGroupFamily._allTransitiveDependencies,
        groupId: groupId,
      );

  StaffroomGroupProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.groupId,
  }) : super.internal();

  final String groupId;

  @override
  Override overrideWith(
    FutureOr<Group?> Function(StaffroomGroupRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: StaffroomGroupProvider._internal(
        (ref) => create(ref as StaffroomGroupRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        groupId: groupId,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<Group?> createElement() {
    return _StaffroomGroupProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is StaffroomGroupProvider && other.groupId == groupId;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, groupId.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin StaffroomGroupRef on AutoDisposeFutureProviderRef<Group?> {
  /// The parameter `groupId` of this provider.
  String get groupId;
}

class _StaffroomGroupProviderElement
    extends AutoDisposeFutureProviderElement<Group?>
    with StaffroomGroupRef {
  _StaffroomGroupProviderElement(super.provider);

  @override
  String get groupId => (origin as StaffroomGroupProvider).groupId;
}

String _$groupPostsHash() => r'ea6eebee88eb7177fe34161d8772249209a04cc1';

/// **ONE-SHOT.family.** One group's posts (`getGroupPostsAction`). **Member-
/// gated**: the real impl throws Forbidden for a non-member, which surfaces as a
/// `.error` [AsyncValue] → the group detail shows a locked "members only"
/// preview (never the posts).
///
/// Copied from [groupPosts].
@ProviderFor(groupPosts)
const groupPostsProvider = GroupPostsFamily();

/// **ONE-SHOT.family.** One group's posts (`getGroupPostsAction`). **Member-
/// gated**: the real impl throws Forbidden for a non-member, which surfaces as a
/// `.error` [AsyncValue] → the group detail shows a locked "members only"
/// preview (never the posts).
///
/// Copied from [groupPosts].
class GroupPostsFamily extends Family<AsyncValue<List<GroupPost>>> {
  /// **ONE-SHOT.family.** One group's posts (`getGroupPostsAction`). **Member-
  /// gated**: the real impl throws Forbidden for a non-member, which surfaces as a
  /// `.error` [AsyncValue] → the group detail shows a locked "members only"
  /// preview (never the posts).
  ///
  /// Copied from [groupPosts].
  const GroupPostsFamily();

  /// **ONE-SHOT.family.** One group's posts (`getGroupPostsAction`). **Member-
  /// gated**: the real impl throws Forbidden for a non-member, which surfaces as a
  /// `.error` [AsyncValue] → the group detail shows a locked "members only"
  /// preview (never the posts).
  ///
  /// Copied from [groupPosts].
  GroupPostsProvider call(String groupId) {
    return GroupPostsProvider(groupId);
  }

  @override
  GroupPostsProvider getProviderOverride(
    covariant GroupPostsProvider provider,
  ) {
    return call(provider.groupId);
  }

  static const Iterable<ProviderOrFamily>? _dependencies = null;

  @override
  Iterable<ProviderOrFamily>? get dependencies => _dependencies;

  static const Iterable<ProviderOrFamily>? _allTransitiveDependencies = null;

  @override
  Iterable<ProviderOrFamily>? get allTransitiveDependencies =>
      _allTransitiveDependencies;

  @override
  String? get name => r'groupPostsProvider';
}

/// **ONE-SHOT.family.** One group's posts (`getGroupPostsAction`). **Member-
/// gated**: the real impl throws Forbidden for a non-member, which surfaces as a
/// `.error` [AsyncValue] → the group detail shows a locked "members only"
/// preview (never the posts).
///
/// Copied from [groupPosts].
class GroupPostsProvider extends AutoDisposeFutureProvider<List<GroupPost>> {
  /// **ONE-SHOT.family.** One group's posts (`getGroupPostsAction`). **Member-
  /// gated**: the real impl throws Forbidden for a non-member, which surfaces as a
  /// `.error` [AsyncValue] → the group detail shows a locked "members only"
  /// preview (never the posts).
  ///
  /// Copied from [groupPosts].
  GroupPostsProvider(String groupId)
    : this._internal(
        (ref) => groupPosts(ref as GroupPostsRef, groupId),
        from: groupPostsProvider,
        name: r'groupPostsProvider',
        debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
            ? null
            : _$groupPostsHash,
        dependencies: GroupPostsFamily._dependencies,
        allTransitiveDependencies: GroupPostsFamily._allTransitiveDependencies,
        groupId: groupId,
      );

  GroupPostsProvider._internal(
    super._createNotifier, {
    required super.name,
    required super.dependencies,
    required super.allTransitiveDependencies,
    required super.debugGetCreateSourceHash,
    required super.from,
    required this.groupId,
  }) : super.internal();

  final String groupId;

  @override
  Override overrideWith(
    FutureOr<List<GroupPost>> Function(GroupPostsRef provider) create,
  ) {
    return ProviderOverride(
      origin: this,
      override: GroupPostsProvider._internal(
        (ref) => create(ref as GroupPostsRef),
        from: from,
        name: null,
        dependencies: null,
        allTransitiveDependencies: null,
        debugGetCreateSourceHash: null,
        groupId: groupId,
      ),
    );
  }

  @override
  AutoDisposeFutureProviderElement<List<GroupPost>> createElement() {
    return _GroupPostsProviderElement(this);
  }

  @override
  bool operator ==(Object other) {
    return other is GroupPostsProvider && other.groupId == groupId;
  }

  @override
  int get hashCode {
    var hash = _SystemHash.combine(0, runtimeType.hashCode);
    hash = _SystemHash.combine(hash, groupId.hashCode);

    return _SystemHash.finish(hash);
  }
}

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
mixin GroupPostsRef on AutoDisposeFutureProviderRef<List<GroupPost>> {
  /// The parameter `groupId` of this provider.
  String get groupId;
}

class _GroupPostsProviderElement
    extends AutoDisposeFutureProviderElement<List<GroupPost>>
    with GroupPostsRef {
  _GroupPostsProviderElement(super.provider);

  @override
  String get groupId => (origin as GroupPostsProvider).groupId;
}

String _$currentStaffroomUserIdHash() =>
    r'7ec5d654a8da12ca49192af3c6e7a7a2f2d0249f';

/// The current user's uid for the Staffroom, mirroring `currentInboxUserId`
/// (SPEC §0 — server-derived `x-user-id`, never client-supplied). It returns
/// `null` today (no client auth identity yet): combined with the deferred
/// transport's empty reads, the Staffroom home renders its "sign in to join"
/// surface on-device.
///
/// A deliberately thin, overridable seam:
///   • the live handoff repoints it to `FirebaseAuth.instance.currentUser?.uid`;
///   • widget tests override it with a fixed uid to exercise the feed rows,
///     the groups strip, likes and the join button.
///
/// Copied from [currentStaffroomUserId].
@ProviderFor(currentStaffroomUserId)
final currentStaffroomUserIdProvider = AutoDisposeProvider<String?>.internal(
  currentStaffroomUserId,
  name: r'currentStaffroomUserIdProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$currentStaffroomUserIdHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef CurrentStaffroomUserIdRef = AutoDisposeProviderRef<String?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
