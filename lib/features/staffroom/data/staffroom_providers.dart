import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/network/api_exception.dart';
import '../domain/community_post.dart';
import '../domain/connection.dart';
import '../domain/group.dart';
import '../domain/staffroom_results.dart';
import '../domain/teacher.dart';
import 'staffroom_transport.dart';

part 'staffroom_providers.g.dart';

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
@riverpod
Future<void> ensuredUserGroups(Ref ref) async {
  final transport = ref.watch(staffroomTransportProvider);
  try {
    await transport.ensureUserGroups();
    ref.keepAlive();
  } catch (error) {
    debugPrint('ensureUserGroups failed (non-fatal): $error');
  }
}

/// **ONE-SHOT.** The unified feed (`GET /api/groups/feed`) — the primary
/// surface whose [AsyncValue] drives the Staffroom home's loading / error /
/// ready state.
@riverpod
Future<List<FeedItem>> unifiedFeed(Ref ref) async {
  await ref.watch(ensuredUserGroupsProvider.future);
  return ref.watch(staffroomTransportProvider).getUnifiedFeed();
}

/// **ONE-SHOT.** The teacher's own groups (`GET /api/groups`) — "Your groups",
/// the composer's group picker, and a membership source for group detail.
@riverpod
Future<List<Group>> myGroups(Ref ref) async {
  await ref.watch(ensuredUserGroupsProvider.future);
  return ref.watch(staffroomTransportProvider).getMyGroups();
}

/// **ONE-SHOT.** Suggested, not-yet-joined groups (`GET /api/groups/discover`).
@riverpod
Future<List<Group>> discoverGroups(Ref ref) =>
    ref.watch(staffroomTransportProvider).discoverGroups();

/// **ONE-SHOT.** "People you may know" (`GET
/// /api/community/teachers/recommended`, ≤5).
@riverpod
Future<List<TeacherSuggestion>> recommendedTeachers(Ref ref) =>
    ref.watch(staffroomTransportProvider).getRecommendedTeachers();

/// **ONE-SHOT.** The ids the current user has already liked
/// (`GET /api/community/likes`) — hydrates filled hearts on mount.
@riverpod
Future<LikedItemIds> likedItemIds(Ref ref) =>
    ref.watch(staffroomTransportProvider).getLikedItemIds();

/// **ONE-SHOT.family.** One group's metadata (`GET /api/groups/{id}`) — the
/// group detail header. `null` → the group was not found / removed.
@riverpod
Future<Group?> staffroomGroup(Ref ref, String groupId) =>
    ref.watch(staffroomTransportProvider).getGroup(groupId);

/// **ONE-SHOT.family.** One group's posts (`GET /api/groups/{id}/posts`).
/// **Member-gated**: a non-member gets a 403 [ApiException]
/// ([ApiErrorKind.forbidden]), which the group detail renders as the locked
/// "members only" preview; any other error is a real error + retry.
@riverpod
Future<List<GroupPost>> groupPosts(Ref ref, String groupId) =>
    ref.watch(staffroomTransportProvider).getGroupPosts(groupId);

/// True when [error] is the posts route's membership gate (403), as opposed to
/// a network / server failure.
bool isMembershipGate(Object? error) =>
    error is ApiException && error.kind == ApiErrorKind.forbidden;

/// Invalidates every read a membership change affects — the feed, the
/// teacher's groups, suggestions, and the group's own header + posts — so a
/// join shows up everywhere without a manual refresh.
void invalidateAfterMembershipChange(WidgetRef ref, String groupId) {
  ref
    ..invalidate(myGroupsProvider)
    ..invalidate(discoverGroupsProvider)
    ..invalidate(unifiedFeedProvider)
    ..invalidate(groupPostsProvider(groupId))
    ..invalidate(staffroomGroupProvider(groupId));
}

/// The teacher's connection graph (`GET /api/connections/mine`) and the only
/// write path for it. Every card, row and pane reads its [ConnectionStatus]
/// from here, so a request sent from "People you may know" shows "Requested"
/// everywhere at once.
///
/// Each intent method calls the route FIRST and only then publishes the new
/// state (never an optimistic pre-commit republish); a failure rethrows to the
/// caller, which shows an inline error, and leaves the state untouched.
@riverpod
class ConnectionsController extends _$ConnectionsController {
  @override
  Future<MyConnectionData> build() =>
      ref.watch(staffroomTransportProvider).getMyConnectionData();

  MyConnectionData get _current =>
      state.valueOrNull ?? const MyConnectionData();

  /// Sends a request to [uid] and settles that teacher's status from the
  /// server's answer (`sent` / `already_pending` / `already_connected`).
  Future<ConnectionRequestResult> request(String uid) async {
    final result =
        await ref.read(staffroomTransportProvider).sendConnectionRequest(uid);
    final current = _current;
    final next = switch (result) {
      ConnectionRequestResult.alreadyConnected => _with(
          current,
          connected: <String>{...current.connectedUids, uid},
          sent: current.sentRequestUids.where((u) => u != uid),
          received: current.receivedRequests.where((r) => r.uid != uid),
        ),
      // `already_pending` means a request exists in EITHER direction. If it is
      // one we received, the status is already "pending received"; otherwise
      // it is ours.
      ConnectionRequestResult.alreadyPending =>
        current.receivedRequests.any((r) => r.uid == uid)
            ? current
            : _with(current, sent: <String>{...current.sentRequestUids, uid}),
      ConnectionRequestResult.sent =>
        _with(current, sent: <String>{...current.sentRequestUids, uid}),
    };
    state = AsyncData<MyConnectionData>(next);
    return result;
  }

  /// Accepts the pending request from [uid] (recipient only).
  Future<void> accept(String uid) async {
    final requestId = _current.requestIdFrom(uid);
    if (requestId == null) return;
    await ref
        .read(staffroomTransportProvider)
        .acceptConnectionRequest(requestId);
    final current = _current;
    state = AsyncData<MyConnectionData>(
      _with(
        current,
        connected: <String>{...current.connectedUids, uid},
        received: current.receivedRequests.where((r) => r.uid != uid),
      ),
    );
  }

  /// Declines the pending request from [uid].
  Future<void> decline(String uid) async {
    final requestId = _current.requestIdFrom(uid);
    if (requestId == null) return;
    await ref
        .read(staffroomTransportProvider)
        .declineConnectionRequest(requestId);
    final current = _current;
    state = AsyncData<MyConnectionData>(
      _with(
        current,
        received: current.receivedRequests.where((r) => r.uid != uid),
      ),
    );
  }

  /// Removes the accepted connection with [uid].
  Future<void> disconnect(String uid) async {
    await ref.read(staffroomTransportProvider).disconnect(uid);
    final current = _current;
    state = AsyncData<MyConnectionData>(
      _with(current, connected: current.connectedUids.where((u) => u != uid)),
    );
  }

  static MyConnectionData _with(
    MyConnectionData base, {
    Iterable<String>? connected,
    Iterable<String>? sent,
    Iterable<ReceivedConnectionRequest>? received,
  }) =>
      MyConnectionData(
        connectedUids: List<String>.unmodifiable(
          connected ?? base.connectedUids,
        ),
        sentRequestUids: List<String>.unmodifiable(
          sent ?? base.sentRequestUids,
        ),
        receivedRequests: List<ReceivedConnectionRequest>.unmodifiable(
          received ?? base.receivedRequests,
        ),
      );
}

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
@riverpod
String? currentStaffroomUserId(Ref ref) {
  final status = ref.watch(authControllerProvider);
  if (status != AuthStatus.signedIn) return null;
  return FirebaseAuth.instance.currentUser?.uid;
}
