import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../staffroom/data/staffroom_providers.dart';
import '../data/moderation_repository.dart';
import '../domain/moderation.dart';

/// The teachers the signed-in teacher has blocked: the one owner of that fact
/// in the app. Posts, chat messages and conversations from anyone in it are
/// hidden at once (see [blockedUidsProvider]); the server also filters the feed
/// and refuses direct messages either way.
///
/// Every change goes through [ModerationRepository] and lands in the state
/// only after the server has stored it.
class BlockedTeachers extends AsyncNotifier<List<BlockedTeacher>> {
  @override
  Future<List<BlockedTeacher>> build() async {
    if (!ref.watch(isSignedInProvider)) return const [];
    try {
      return await ref.read(moderationRepositoryProvider).blocked();
    } catch (_) {
      // A failed read must not break the feed or the chat it filters: nothing
      // is hidden that the server is not already hiding.
      return const [];
    }
  }

  /// Blocks [uid]. Throws the typed `ApiException` when the server refuses,
  /// so the caller can say so; the list changes only after the block is stored.
  Future<void> block(String uid, String name) async {
    await ref.read(moderationRepositoryProvider).block(uid);
    final current = state.valueOrNull ?? const <BlockedTeacher>[];
    if (!current.any((t) => t.uid == uid)) {
      state = AsyncData([...current, BlockedTeacher(uid: uid, name: name)]);
    }
    // The server now filters them out of these too.
    ref
      ..invalidate(unifiedFeedProvider)
      ..invalidate(groupPostsProvider)
      ..invalidate(recommendedTeachersProvider);
  }

  /// Unblocks [uid]. Throws the typed `ApiException` when the server refuses.
  Future<void> unblock(String uid) async {
    await ref.read(moderationRepositoryProvider).unblock(uid);
    final current = state.valueOrNull ?? const <BlockedTeacher>[];
    state = AsyncData([
      for (final t in current)
        if (t.uid != uid) t,
    ]);
    ref
      ..invalidate(unifiedFeedProvider)
      ..invalidate(groupPostsProvider)
      ..invalidate(recommendedTeachersProvider);
  }
}

final blockedTeachersProvider =
    AsyncNotifierProvider<BlockedTeachers, List<BlockedTeacher>>(
      BlockedTeachers.new,
    );

/// The uids to hide. Empty while the list loads or when it failed to load.
final blockedUidsProvider = Provider<Set<String>>((ref) {
  final list = ref.watch(blockedTeachersProvider).valueOrNull;
  return {for (final t in list ?? const <BlockedTeacher>[]) t.uid};
});
