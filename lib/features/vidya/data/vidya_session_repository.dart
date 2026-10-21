import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import 'dto/chat_message.dart';
import 'dto/vidya_session.dart';

part 'vidya_session_repository.g.dart';

/// VIDYA session persistence — `GET/POST /api/vidya/session`. On login the
/// latest session (capped 50 messages) is restored; each turn pair is written
/// back fire-and-forget. Live restore needs real auth (401 on the stub token);
/// the plumbing is testable now.
class VidyaSessionRepository {
  const VidyaSessionRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/vidya/session';

  /// The most recent session, or an empty one (`sessionId: null`) for a teacher
  /// who has never spoken to VIDYA.
  Future<VidyaSession> fetchLatest() {
    return _client.get<VidyaSession>(
      _path,
      decode: (json) => VidyaSession.fromJson(
        (json as Map?)?.cast<String, dynamic>() ?? const {},
      ),
    );
  }

  /// Upserts the session. [actionTriggered] is a pre-shaped
  /// `{ flow, params }` NAVIGATE_AND_FILL event (the controller owns its shape);
  /// [isNew] writes `createdAt` only on the first save.
  Future<void> save({
    required String sessionId,
    required List<ChatMessage> messages,
    Map<String, dynamic>? actionTriggered,
    String? screenPath,
    bool isNew = false,
  }) {
    return _client.post<void>(
      _path,
      data: {
        'sessionId': sessionId,
        'messages': messages.map((m) => m.toJson()).toList(),
        'actionTriggered': ?actionTriggered,
        'screenPath': ?screenPath,
        if (isNew) 'isNew': true,
      },
      decode: (_) {},
    );
  }
}

@riverpod
VidyaSessionRepository vidyaSessionRepository(Ref ref) =>
    VidyaSessionRepository(ref.watch(apiClientProvider));
