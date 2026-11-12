import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/api_client.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/api_providers.dart';

/// Why a teacher reports a piece of AI output. [wire] is what lands in the
/// report for the team reviewing it.
enum AiReportReason {
  offensive('offensive_or_harmful'),
  wrong('wrong_or_misleading'),
  unsuitable('unsuitable_for_students'),
  other('other');

  const AiReportReason(this.wire);
  final String wire;
}

/// Sends a teacher's report about AI-generated content (a VIDYA reply or a
/// tool's result) to the team, without leaving the app.
///
/// Google Play's AI-generated content policy requires exactly this: an
/// in-app way to report or flag offensive AI output to the developer. It uses
/// the existing `POST /api/feedback/app` route, which stores a thumbs-down
/// with its comment and context in the `feedbacks` collection for review;
/// no backend change was needed.
class AiReportRepository {
  const AiReportRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/feedback/app';

  /// The longest excerpt of the reported content kept with the report.
  static const int excerptMax = 1000;

  /// Files the report. Throws [ApiException] when it was not stored — the
  /// route answers 200 with `success: false` on a storage failure, so the
  /// body is checked, not just the status.
  Future<void> report({
    required String feature,
    required String page,
    required AiReportReason reason,
    required String content,
    String? note,
  }) async {
    final trimmedNote = note?.trim() ?? '';
    final excerpt = content.trim().length > excerptMax
        ? content.trim().substring(0, excerptMax)
        : content.trim();
    final stored = await _client.post<bool>(
      _path,
      data: <String, dynamic>{
        'page': _cap(page, 300),
        'feature': _cap('ai-report:$feature', 300),
        'rating': 'thumbs-down',
        // The route requires a comment on a thumbs-down; the reason always
        // leads it, so a report without a note is still valid.
        'comment': _cap(
          trimmedNote.isEmpty
              ? '[${reason.wire}]'
              : '[${reason.wire}] $trimmedNote',
          2000,
        ),
        'context': <String, dynamic>{
          'kind': 'ai_content_report',
          'reason': reason.wire,
          'excerpt': excerpt,
        },
      },
      decode: (json) => json['success'] == true,
    );
    if (!stored) {
      throw const ApiException(
        ApiErrorKind.server,
        'The report was not stored.',
      );
    }
  }

  static String _cap(String value, int max) =>
      value.length > max ? value.substring(0, max) : value;
}

final aiReportRepositoryProvider = Provider<AiReportRepository>(
  (ref) => AiReportRepository(ref.watch(apiClientProvider)),
);
