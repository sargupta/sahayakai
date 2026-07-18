import 'package:flutter/foundation.dart';

/// Who spoke a turn. The wire uses Gemini's role names: `user` for the teacher,
/// `model` for VIDYA.
enum ChatRole { user, model }

/// One conversation turn, in the exact shape both `/api/assistant`
/// (`chatHistory`) and `/api/vidya/session` (`messages`) use:
/// `{ "role": "user"|"model", "parts": [{ "text": "…" }] }`.
///
/// Hand-serialised (not json_serializable) because the `parts` array wrapper is
/// a fixed one-element shape — codegen would only obscure it.
@immutable
class ChatMessage {
  const ChatMessage({required this.role, required this.text});

  final ChatRole role;
  final String text;

  Map<String, dynamic> toJson() => {
        'role': role.name, // 'user' | 'model'
        'parts': [
          {'text': text},
        ],
      };

  /// Parses one wire turn. Returns null for a shapeless entry (defensive — the
  /// session doc is model-written and capped, so a stray entry must not crash a
  /// restore). Flattens `parts[]` by joining every `text` fragment.
  static ChatMessage? fromJson(Map<String, dynamic> json) {
    final role = json['role'] == 'model' ? ChatRole.model : ChatRole.user;
    final parts = json['parts'];
    final buffer = StringBuffer();
    if (parts is List) {
      for (final p in parts) {
        if (p is Map && p['text'] is String) buffer.write(p['text'] as String);
      }
    }
    final text = buffer.toString();
    if (text.isEmpty) return null;
    return ChatMessage(role: role, text: text);
  }

  @override
  bool operator ==(Object other) =>
      other is ChatMessage && other.role == role && other.text == text;

  @override
  int get hashCode => Object.hash(role, text);
}
