// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'staffroom_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$ensuredUserGroupsHash() => r'005b218e440dc64163395e9771b7b57f8a7e91f0';

/// # Staffroom read providers
///
/// Thin Riverpod wrappers over the [StaffroomTransport] REST reads. The feed,
/// groups and recommendations are **one-shot server reads** (the web polls them
/// on focus), so these are `FutureProvider`s, not `StreamProvider`s. Pull to
/// refresh invalidates them.
///
/// Signed out (or Firebase unconfigured) the bound transport is
/// [DeferredStaffroomTransport], whose reads resolve empty; the screens read
/// the signed-out surface off [currentStaffroomUserId] (null), so a `null` uid
/// means "sign in to join the staffroom" regardless of what the reads return.
/// **ONCE PER SESSION.** `POST /api/groups/ensure` — idempotently provisions
/// the teacher's default groups (subject/grade, state, Daily Briefing,
/// Community) the way the web does on first open of the community page.
/// Without it a brand-new teacher has no groups and an empty feed.
///
/// Best-effort by design: a failure here must not block the feed or the
/// groups list (both still return whatever groups already exist), so the
/// error is logged, not rethrown. The provider only stays alive after a
/// SUCCESS, so a failed attempt is retried the next time a screen reads it.
///
/// Copied from [ensuredUserGroups].
@ProviderFor(ensuredUserGroups)
final ensuredUserGroupsProvider = AutoDisposeFutureProvider<void>.internal(
  ensuredUserGroups,
  name: r'ensuredUserGroupsProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$ensuredUserGroupsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef EnsuredUserGroupsRef = AutoDisposeFutureProviderRef<void>;
String _$unifiedFeedHash() => r'4c12bbf9a76660f6fa8b85944472cd14c9fb804b';

/// **ONE-SHOT.** The unified feed (`GET /api/groups/feed`) — the primary
/// surface whose [AsyncValue] drives the Staffroom home's loading / error /
/// ready state.
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
String _$myGroupsHash() => r'e4dc9e0bd6e7e369b95944883dc8fa02bb9a5d15';

/// **ONE-SHOT.** The teacher's own groups (`GET /api/groups`) — "Your groups",
/// the composer's group picker, and a membership source for group detail.
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

/// **ONE-SHOT.** Suggested, not-yet-joined groups (`GET /api/groups/discover`).
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

/// **ONE-SHOT.** "People you may know" (`GET
/// /api/community/teachers/recommended`, ≤5).
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
/// (`GET /api/community/likes`) — hydrates filled hearts on mount.
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

/// **ONE-SHOT.family.** One group's metadata (`GET /api/groups/{id}`) — the
/// group detail header. `null` → the group was not found / removed.
///
/// Copied from [staffroomGroup].
@ProviderFor(staffroomGroup)
const staffroomGroupProvider = StaffroomGroupFamily();

/// **ONE-SHOT.family.** One group's metadata (`GET /api/groups/{id}`) — the
/// group detail header. `null` → the group was not found / removed.
///
/// Copied from [staffroomGroup].
class StaffroomGroupFamily extends Family<AsyncValue<Group?>> {
  /// **ONE-SHOT.family.** One group's metadata (`GET /api/groups/{id}`) — the
  /// group detail header. `null` → the group was not found / removed.
  ///
  /// Copied from [staffroomGroup].
  const StaffroomGroupFamily();

  /// **ONE-SHOT.family.** One group's metadata (`GET /api/groups/{id}`) — the
  /// group detail header. `null` → the group was not found / removed.
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

/// **ONE-SHOT.family.** One group's metadata (`GET /api/groups/{id}`) — the
/// group detail header. `null` → the group was not found / removed.
///
/// Copied from [staffroomGroup].
class StaffroomGroupProvider extends AutoDisposeFutureProvider<Group?> {
  /// **ONE-SHOT.family.** One group's metadata (`GET /api/groups/{id}`) — the
  /// group detail header. `null` → the group was not found / removed.
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

/// **ONE-SHOT.family.** One group's posts (`GET /api/groups/{id}/posts`).
/// **Member-gated**: a non-member gets a 403 [ApiException]
/// ([ApiErrorKind.forbidden]), which the group detail renders as the locked
/// "members only" preview; any other error is a real error + retry.
///
/// Copied from [groupPosts].
@ProviderFor(groupPosts)
const groupPostsProvider = GroupPostsFamily();

/// **ONE-SHOT.family.** One group's posts (`GET /api/groups/{id}/posts`).
/// **Member-gated**: a non-member gets a 403 [ApiException]
/// ([ApiErrorKind.forbidden]), which the group detail renders as the locked
/// "members only" preview; any other error is a real error + retry.
///
/// Copied from [groupPosts].
class GroupPostsFamily extends Family<AsyncValue<List<GroupPost>>> {
  /// **ONE-SHOT.family.** One group's posts (`GET /api/groups/{id}/posts`).
  /// **Member-gated**: a non-member gets a 403 [ApiException]
  /// ([ApiErrorKind.forbidden]), which the group detail renders as the locked
  /// "members only" preview; any other error is a real error + retry.
  ///
  /// Copied from [groupPosts].
  const GroupPostsFamily();

  /// **ONE-SHOT.family.** One group's posts (`GET /api/groups/{id}/posts`).
  /// **Member-gated**: a non-member gets a 403 [ApiException]
  /// ([ApiErrorKind.forbidden]), which the group detail renders as the locked
  /// "members only" preview; any other error is a real error + retry.
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

/// **ONE-SHOT.family.** One group's posts (`GET /api/groups/{id}/posts`).
/// **Member-gated**: a non-member gets a 403 [ApiException]
/// ([ApiErrorKind.forbidden]), which the group detail renders as the locked
/// "members only" preview; any other error is a real error + retry.
///
/// Copied from [groupPosts].
class GroupPostsProvider extends AutoDisposeFutureProvider<List<GroupPost>> {
  /// **ONE-SHOT.family.** One group's posts (`GET /api/groups/{id}/posts`).
  /// **Member-gated**: a non-member gets a 403 [ApiException]
  /// ([ApiErrorKind.forbidden]), which the group detail renders as the locked
  /// "members only" preview; any other error is a real error + retry.
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
    r'cd30c606491d4fb748d22064fda0686b28cd7002';

/// The current user's uid for the Staffroom, mirroring `currentInboxUserId`
/// (`features/inbox/data/messages_stream_provider.dart`).
///
/// **LIVE (T1-U5).** Watches [authControllerProvider] — the same source of
/// truth the router and [staffroomTransportProvider] already agree on — and
/// resolves to `FirebaseAuth.instance.currentUser?.uid` for a real signed-in
/// teacher, `null` otherwise. A `null` uid is itself treated as "signed out"
/// by the screens (defensive), which also covers the on-device deferred case:
/// while Firebase isn't wired [staffroomTransportProvider] only ever emits
/// `awaitingFirebase` / empty reads, so this uid is irrelevant to what renders
/// either way.
///
/// A deliberately thin, overridable seam: widget tests override it with a
/// fixed uid to exercise the feed rows, the groups strip, likes and the join
/// button without touching real auth.
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
String _$connectionsControllerHash() =>
    r'f49fdeef8989282d5968ebbcc886b5a54161337b';

/// The teacher's connection graph (`GET /api/connections/mine`) and the only
/// write path for it. Every card, row and pane reads its [ConnectionStatus]
/// from here, so a request sent from "People you may know" shows "Requested"
/// everywhere at once.
///
/// Each intent method calls the route FIRST and only then publishes the new
/// state (never an optimistic pre-commit republish); a failure rethrows to the
/// caller, which shows an inline error, and leaves the state untouched.
///
/// Copied from [ConnectionsController].
@ProviderFor(ConnectionsController)
final connectionsControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      ConnectionsController,
      MyConnectionData
    >.internal(
      ConnectionsController.new,
      name: r'connectionsControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$connectionsControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$ConnectionsController = AutoDisposeAsyncNotifier<MyConnectionData>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
