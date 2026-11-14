import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/moderation.dart';

/// The moderation routes (backend `src/app/api/moderation/*`):
///
/// - `POST   /api/moderation/report` `{ targetType, targetId, reason, freeText? }`
/// - `POST   /api/moderation/block`  `{ blockedUid }`
/// - `DELETE /api/moderation/block`  `{ blockedUid }`
/// - `GET    /api/moderation/blocks` → `{ blocks: [{ blockedUid, displayName, photoURL, createdAt }] }`
///
/// The server already hides a blocked teacher's posts from the feed and refuses
/// direct messages either way; the app also hides them at once (see
/// `BlockedTeachers`). Reports are rate-limited to 10 a day (429 →
/// `ApiErrorKind.rateLimited`).
class ModerationRepository {
  const ModerationRepository(this._client);

  final ApiClient _client;

  /// Returns once the report is stored.
  Future<void> report({
    required ReportTarget target,
    required String targetId,
    required ReportReason reason,
    String? details,
  }) async {
    final text = details?.trim();
    await _client.post<void>(
      '/api/moderation/report',
      data: {
        'targetType': target.wire,
        'targetId': targetId,
        'reason': reason.wire,
        if (text != null && text.isNotEmpty)
          'freeText': text.length > kReportDetailsMax
              ? text.substring(0, kReportDetailsMax)
              : text,
      },
      decode: (_) {},
    );
  }

  /// Returns once the block is stored (idempotent server-side).
  Future<void> block(String uid) => _client.post<void>(
    '/api/moderation/block',
    data: {'blockedUid': uid},
    decode: (_) {},
  );

  /// Returns once the block is removed.
  Future<void> unblock(String uid) => _client.delete<void>(
    '/api/moderation/block',
    data: {'blockedUid': uid},
    decode: (_) {},
  );

  /// The teachers the signed-in teacher has blocked.
  Future<List<BlockedTeacher>> blocked() => _client.get<List<BlockedTeacher>>(
    '/api/moderation/blocks',
    decode: (json) {
      final list = json is Map ? json['blocks'] : null;
      if (list is! List) return const [];
      return [
        for (final item in list)
          if (item is Map && item['blockedUid'] is String)
            BlockedTeacher(
              uid: item['blockedUid'] as String,
              name: (item['displayName'] as String?)?.trim() ?? '',
              photoUrl: item['photoURL'] as String?,
            ),
      ];
    },
  );
}

final moderationRepositoryProvider = Provider<ModerationRepository>(
  (ref) => ModerationRepository(ref.watch(apiClientProvider)),
);
