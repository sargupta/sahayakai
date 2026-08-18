import 'package:flutter/foundation.dart';

import 'chat_message.dart';
import 'vidya_profile.dart';

/// The `POST /api/assistant` request body (SPEC §A.3). Hand-serialised because
/// it is write-only and nests fixed shapes; [toJson] omits the optional fields
/// the caller left null so the server applies its own defaults.
///
/// Language: [detectedLanguage] is the STT best-guess (can be wrong for Indic
/// scripts); [uiLanguage] is the app's EXPLICIT language and **wins** on the
/// server. Send both — the route lets `uiLanguage` decide the reply language.
@immutable
class AssistantRequest {
  const AssistantRequest({
    required this.message,
    this.chatHistory = const [],
    this.screenPath,
    this.screenUiState,
    this.teacherProfile,
    this.detectedLanguage,
    this.uiLanguage,
  });

  /// Required, capped server-side at 4000 chars (400 `MESSAGE_TOO_LONG` over).
  final String message;
  final List<ChatMessage> chatHistory;
  final String? screenPath;
  final Map<String, dynamic>? screenUiState;
  final VidyaProfile? teacherProfile;
  final String? detectedLanguage;
  final String? uiLanguage;

  Map<String, dynamic> toJson() {
    final profile = teacherProfile;
    return {
      'message': message,
      if (chatHistory.isNotEmpty)
        'chatHistory': chatHistory.map((m) => m.toJson()).toList(),
      if (screenPath != null)
        'currentScreenContext': {
          'path': screenPath,
          if (screenUiState != null && screenUiState!.isNotEmpty)
            'uiState': screenUiState,
        },
      if (profile != null && !profile.isEmpty) 'teacherProfile': profile.toJson(),
      if (detectedLanguage != null) 'detectedLanguage': detectedLanguage,
      if (uiLanguage != null) 'uiLanguage': uiLanguage,
    };
  }
}
