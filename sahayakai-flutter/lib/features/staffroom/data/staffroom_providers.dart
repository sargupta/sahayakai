import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/auth/auth_providers.dart';
import '../domain/community_post.dart';
import '../domain/group.dart';
import '../domain/staffroom_results.dart';
import '../domain/teacher.dart';
import 'staffroom_transport.dart';

part 'staffroom_providers.g.dart';

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
@riverpod
Future<List<FeedItem>> unifiedFeed(Ref ref) =>
    ref.watch(staffroomTransportProvider).getUnifiedFeed();

/// **ONE-SHOT.** The teacher's own groups (`getMyGroupsAction`) — the "Your
/// groups" strip, and the source of truth for whether a group is already joined.
@riverpod
Future<List<Group>> myGroups(Ref ref) =>
    ref.watch(staffroomTransportProvider).getMyGroups();

/// **ONE-SHOT.** Suggested, not-yet-joined groups (`discoverGroupsAction`) — the
/// "Discover groups" section.
@riverpod
Future<List<Group>> discoverGroups(Ref ref) =>
    ref.watch(staffroomTransportProvider).discoverGroups();

/// **ONE-SHOT.** "People you may know" (`getRecommendedTeachersAction`, ≤5).
@riverpod
Future<List<TeacherSuggestion>> recommendedTeachers(Ref ref) =>
    ref.watch(staffroomTransportProvider).getRecommendedTeachers();

/// **ONE-SHOT.** The ids the current user has already liked
/// (`getLikedItemIdsAction`) — hydrates filled hearts on mount. Defaults to an
/// empty [LikedItemIds] while it resolves, so a post card renders an outline
/// heart first and fills it once this arrives.
@riverpod
Future<LikedItemIds> likedItemIds(Ref ref) =>
    ref.watch(staffroomTransportProvider).getLikedItemIds();

/// **ONE-SHOT.family.** One group's metadata (`getGroupAction`) — the group
/// detail header. `null` → the group was not found / removed.
@riverpod
Future<Group?> staffroomGroup(Ref ref, String groupId) =>
    ref.watch(staffroomTransportProvider).getGroup(groupId);

/// **ONE-SHOT.family.** One group's posts (`getGroupPostsAction`). **Member-
/// gated**: the real impl throws Forbidden for a non-member, which surfaces as a
/// `.error` [AsyncValue] → the group detail shows a locked "members only"
/// preview (never the posts).
@riverpod
Future<List<GroupPost>> groupPosts(Ref ref, String groupId) =>
    ref.watch(staffroomTransportProvider).getGroupPosts(groupId);

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
