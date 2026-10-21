import 'package:flutter/foundation.dart';

/// The result of `likeGroupPostAction(groupId, postId)`
/// (`{ isLiked, newCount }`). Drives the optimistic like toggle: apply
/// optimistically, then reconcile the heart + count against this authoritative
/// server reply (and roll back on error).
@immutable
class LikeResult {
  const LikeResult({required this.isLiked, required this.newCount});

  final bool isLiked;
  final int newCount;

  @override
  bool operator ==(Object other) =>
      other is LikeResult &&
      other.isLiked == isLiked &&
      other.newCount == newCount;

  @override
  int get hashCode => Object.hash(isLiked, newCount);
}

/// The hydration bundle from `getLikedItemIdsAction`
/// (`{ groupPostIds[], resourceIds[] }`) — the ids the current user has already
/// liked, so filled hearts render correctly on mount.
@immutable
class LikedItemIds {
  const LikedItemIds({
    this.groupPostIds = const <String>[],
    this.resourceIds = const <String>[],
  });

  final List<String> groupPostIds;
  final List<String> resourceIds;

  bool likedPost(String postId) => groupPostIds.contains(postId);
  bool likedResource(String resourceId) => resourceIds.contains(resourceId);

  @override
  bool operator ==(Object other) =>
      other is LikedItemIds &&
      listEquals(other.groupPostIds, groupPostIds) &&
      listEquals(other.resourceIds, resourceIds);

  @override
  int get hashCode =>
      Object.hash(Object.hashAll(groupPostIds), Object.hashAll(resourceIds));
}
