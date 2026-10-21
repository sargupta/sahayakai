import 'package:json_annotation/json_annotation.dart';

import '../../domain/conversation_id.dart';
import '../../domain/inbox_models.dart';
import 'wire_time.dart';

part 'conversation_dto.g.dart';

/// Decodes a `conversations/{id}` document
/// (`src/types/messages.ts::Conversation`).
///
/// **Real cloud_firestore impl contract:** for an `onSnapshot` over
/// `conversations where participantIds array-contains me orderBy lastMessageAt
/// desc`, build the decode input as `{ 'id': doc.id, ...doc.data() }` and
/// convert every Firestore `Timestamp` to a millis-int or ISO string first (or
/// leave it — [wireTimeToIso] tolerates the `{seconds,nanoseconds}` shape too).
/// The REST-wrapper path (`dbAdapter.serialize`) already emits ISO strings.
///
/// Every field is nullable + tolerantly decoded: a half-written or future doc
/// must degrade to safe defaults, never crash the inbox list (a hang here shipped
/// twice on the web).
@JsonSerializable(createToJson: false)
class ConversationDto {
  const ConversationDto({
    this.id,
    this.type,
    this.participantIds,
    this.participants,
    this.name,
    this.groupPhotoURL,
    this.createdBy,
    this.lastMessage,
    this.lastMessageAt,
    this.lastMessageSenderId,
    this.unreadCount,
    this.createdAt,
    this.updatedAt,
  });

  factory ConversationDto.fromJson(Map<String, dynamic> json) =>
      _$ConversationDtoFromJson(json);

  final String? id;
  final String? type;
  final List<dynamic>? participantIds;

  /// `Record<uid, ParticipantSnapshot>` — kept raw so a stray null / malformed
  /// entry is dropped in [toDomain] instead of throwing.
  final Map<String, dynamic>? participants;
  final String? name;
  final String? groupPhotoURL;
  final String? createdBy;
  final String? lastMessage;

  /// Firestore `Timestamp | null` on the direct path, ISO string on the REST
  /// path — normalised by [wireTimeToIso].
  final dynamic lastMessageAt;
  final String? lastMessageSenderId;

  /// `Record<uid, number>` — kept raw for tolerant int coercion.
  final Map<String, dynamic>? unreadCount;
  final dynamic createdAt;
  final dynamic updatedAt;

  Conversation toDomain() => Conversation(
        id: ConversationId(id?.trim() ?? ''),
        type: ConversationType.fromWire(type),
        participantIds: _stringList(participantIds),
        participants: _participants(participants),
        name: _clean(name),
        groupPhotoURL: _clean(groupPhotoURL),
        createdBy: _clean(createdBy),
        lastMessage: lastMessage?.trim() ?? '',
        lastMessageAt: wireTimeToIso(lastMessageAt),
        lastMessageSenderId: lastMessageSenderId?.trim() ?? '',
        unreadCount: _intMap(unreadCount),
        createdAt: wireTimeToIso(createdAt),
        updatedAt: wireTimeToIso(updatedAt),
      );

  static Map<String, ParticipantSnapshot> _participants(
      Map<String, dynamic>? raw) {
    if (raw == null) return const <String, ParticipantSnapshot>{};
    final out = <String, ParticipantSnapshot>{};
    raw.forEach((uid, value) {
      if (value is Map) {
        final m = value.cast<String, dynamic>();
        out[uid] = ParticipantSnapshot(
          displayName: (m['displayName'] as String?)?.trim() ?? '',
          photoURL: _clean(m['photoURL'] as String?),
          preferredLanguage: _clean(m['preferredLanguage'] as String?),
        );
      }
    });
    return out;
  }
}

/// Serialises the `POST /api/messages/get-or-create-direct` REST-wrapper body.
///
/// The wrapper is the Dio-reachable stand-in for
/// `getOrCreateDirectConversationAction(myUid, otherUid)`. **`myUid` is NOT
/// sent** — the server derives the caller from the verified Bearer token
/// (`x-user-id`) and the action rejects `myUid != caller`. Sending it would only
/// muddy the trust boundary (same reasoning as the parent-hotline F9-001 rule).
@JsonSerializable(includeIfNull: false, createFactory: false)
class GetOrCreateDirectRequestDto {
  const GetOrCreateDirectRequestDto({required this.otherUid});

  final String otherUid;

  Map<String, dynamic> toJson() => _$GetOrCreateDirectRequestDtoToJson(this);
}

/// Serialises the `POST /api/messages/create-group` body (`participantUids`,
/// `name`). The creator is server-derived, not sent.
@JsonSerializable(includeIfNull: false, createFactory: false)
class CreateGroupConversationRequestDto {
  const CreateGroupConversationRequestDto({
    required this.participantUids,
    required this.name,
  });

  final List<String> participantUids;
  final String name;

  Map<String, dynamic> toJson() =>
      _$CreateGroupConversationRequestDtoToJson(this);
}

/// Decodes `{ conversationId }` — the reply from both the get-or-create and
/// create-group wrappers.
@JsonSerializable(createToJson: false)
class ConversationIdResponseDto {
  const ConversationIdResponseDto({this.conversationId});

  factory ConversationIdResponseDto.fromJson(Map<String, dynamic> json) =>
      _$ConversationIdResponseDtoFromJson(json);

  final String? conversationId;

  /// The trimmed id, or empty when absent (the repository treats empty as a
  /// malformed success and throws, per the parent-hotline pattern).
  String get id => conversationId?.trim() ?? '';
}

// ── shared helpers ───────────────────────────────────────────────────────────

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

List<String> _stringList(List<dynamic>? raw) {
  if (raw == null) return const <String>[];
  return raw
      .whereType<String>()
      .map((e) => e.trim())
      .where((e) => e.isNotEmpty)
      .toList(growable: false);
}

/// Coerces a `Record<string, number>` to `Map<String, int>`, tolerating `num`,
/// numeric strings, and dropping non-numeric / negative values.
Map<String, int> _intMap(Map<String, dynamic>? raw) {
  if (raw == null) return const <String, int>{};
  final out = <String, int>{};
  raw.forEach((key, value) {
    final n = switch (value) {
      final int v => v,
      final num v => v.round(),
      final String v => num.tryParse(v)?.round(),
      _ => null,
    };
    if (n != null && n >= 0) out[key] = n;
  });
  return out;
}
