import 'package:flutter/foundation.dart';

import 'chat_message.dart';

/// The most recent VIDYA session from `GET /api/vidya/session`:
/// `{ sessionId: string|null, messages: [{role, parts:[{text}]}] }`. A brand-new
/// teacher (no session yet) returns `{ sessionId: null, messages: [] }`.
@immutable
class VidyaSession {
  const VidyaSession({required this.sessionId, required this.messages});

  final String? sessionId;
  final List<ChatMessage> messages;

  bool get isEmpty => messages.isEmpty;

  static VidyaSession fromJson(Map<String, dynamic> json) {
    final raw = json['messages'];
    final messages = <ChatMessage>[];
    if (raw is List) {
      for (final m in raw) {
        if (m is Map) {
          final parsed = ChatMessage.fromJson(m.cast<String, dynamic>());
          if (parsed != null) messages.add(parsed);
        }
      }
    }
    return VidyaSession(
      sessionId: json['sessionId'] as String?,
      messages: messages,
    );
  }
}
