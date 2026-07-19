import 'package:flutter/foundation.dart';

/// A live chat message shared by the two Staffroom realtime rooms:
///   - the global **Staff Room** (`community_chat` collection), and
///   - a **group chat** (`groups/{id}/chat` sub-collection) — same doc shape.
///
/// Mirrors the `community_chat` doc shape (SPEC §A2) and
/// `src/types/community.ts::GroupChatMessage`:
/// `{ text, authorId, authorName, authorPhotoURL, audioUrl?, createdAt,
/// isDemoPersona? }`. Read live via `onSnapshot(orderBy createdAt asc,
/// limitToLast(100))`.
///
/// `isDemoPersona` marks an AI teacher message (the persona-pulse demo) → the UI
/// stamps a small "AI teacher" badge (§A3.2).
@immutable
class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.text,
    required this.authorId,
    required this.authorName,
    this.authorPhotoURL,
    this.audioUrl,
    this.isDemoPersona = false,
    this.createdAt,
    this.groupId,
  });

  /// Firestore doc id. Null-safe empty on an optimistic pre-server message.
  final String id;

  /// Message body (≤500 chars server-enforced). Empty is allowed only when
  /// [audioUrl] is set (a voice-only message).
  final String text;
  final String authorId;
  final String authorName;
  final String? authorPhotoURL;

  /// Firebase Storage https URL for a voice message, when present.
  final String? audioUrl;

  /// True for an AI persona (demo) message — gets the "AI teacher" badge.
  final bool isDemoPersona;

  /// ISO-8601 string on read; null on an optimistic append (reconciled when the
  /// `onSnapshot` echoes the server doc).
  final String? createdAt;

  /// The owning group id for a `groups/{id}/chat` message; null for the global
  /// `community_chat` room.
  final String? groupId;

  bool get hasAudio => audioUrl != null && audioUrl!.isNotEmpty;

  @override
  bool operator ==(Object other) =>
      other is ChatMessage &&
      other.id == id &&
      other.text == text &&
      other.authorId == authorId &&
      other.authorName == authorName &&
      other.authorPhotoURL == authorPhotoURL &&
      other.audioUrl == audioUrl &&
      other.isDemoPersona == isDemoPersona &&
      other.createdAt == createdAt &&
      other.groupId == groupId;

  @override
  int get hashCode => Object.hash(
        id,
        text,
        authorId,
        authorName,
        authorPhotoURL,
        audioUrl,
        isDemoPersona,
        createdAt,
        groupId,
      );
}
