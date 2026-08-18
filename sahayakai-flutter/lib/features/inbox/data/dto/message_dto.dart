import 'package:json_annotation/json_annotation.dart';

import '../../domain/inbox_models.dart';
import 'wire_time.dart';

part 'message_dto.g.dart';

/// Decodes a `SharedResource` card embedded in a `type:'resource'` message
/// (`src/types/messages.ts::SharedResource`).
@JsonSerializable(createToJson: false)
class SharedResourceDto {
  const SharedResourceDto({
    this.id,
    this.type,
    this.title,
    this.route,
    this.gradeLevel,
    this.subject,
    this.language,
  });

  factory SharedResourceDto.fromJson(Map<String, dynamic> json) =>
      _$SharedResourceDtoFromJson(json);

  final String? id;
  final String? type;
  final String? title;
  final String? route;
  final String? gradeLevel;
  final String? subject;
  final String? language;

  /// null when the card is too malformed to open (no id or no route) — the
  /// message then renders as its plain [Message.text] caption instead of a
  /// broken "Open" button.
  SharedResource? toDomain() {
    final rid = id?.trim();
    final rroute = route?.trim();
    if (rid == null || rid.isEmpty || rroute == null || rroute.isEmpty) {
      return null;
    }
    return SharedResource(
      id: rid,
      kind: SharedResourceKind.fromWire(type),
      title: title?.trim() ?? '',
      route: rroute,
      gradeLevel: _clean(gradeLevel),
      subject: _clean(subject),
      language: _clean(language),
    );
  }
}

/// Decodes a `conversations/{id}/messages/{msgId}` document
/// (`src/types/messages.ts::Message`).
///
/// **Real cloud_firestore impl contract:** for the live tail
/// `onSnapshot(messages orderBy createdAt asc limitToLast(30))` and the static
/// older-pages `getDocs(endBefore cursor)`, build the decode input as
/// `{ 'id': doc.id, ...doc.data() }`. Merge/dedup tail + pages by [id]. Content
/// fields are authored-once (rules forbid client edits after create), so this
/// decode never has to reconcile a mutated body — only appended
/// `readBy`/`deliveredTo`.
@JsonSerializable(createToJson: false)
class MessageDto {
  const MessageDto({
    this.id,
    this.type,
    this.text,
    this.senderId,
    this.senderName,
    this.senderPhotoURL,
    this.resource,
    this.audioUrl,
    this.audioDuration,
    this.readBy,
    this.deliveredTo,
    this.createdAt,
    this.clientMessageId,
    this.deliveryStatus,
  });

  factory MessageDto.fromJson(Map<String, dynamic> json) =>
      _$MessageDtoFromJson(json);

  final String? id;
  final String? type;
  final String? text;
  final String? senderId;
  final String? senderName;
  final String? senderPhotoURL;
  final SharedResourceDto? resource;
  final String? audioUrl;
  final num? audioDuration;
  final List<dynamic>? readBy;
  final List<dynamic>? deliveredTo;
  final dynamic createdAt;
  final String? clientMessageId;
  final String? deliveryStatus;

  Message toDomain() => Message(
        id: _resolvedId,
        type: MessageType.fromWire(type),
        text: text?.trim() ?? '',
        senderId: senderId?.trim() ?? '',
        senderName: senderName?.trim() ?? '',
        senderPhotoURL: _clean(senderPhotoURL),
        resource: resource?.toDomain(),
        audioUrl: _clean(audioUrl),
        audioDuration: audioDuration?.toInt(),
        readBy: _stringList(readBy),
        deliveredTo: _stringList(deliveredTo),
        createdAt: wireTimeToIso(createdAt),
        clientMessageId: _clean(clientMessageId),
        deliveryStatus: deliveryStatus == null
            ? null
            : MessageDeliveryStatus.fromWire(deliveryStatus),
      );

  /// The doc id, falling back to [clientMessageId] (for an idempotent send the
  /// server uses the client id AS the doc id) then to empty.
  String get _resolvedId {
    final docId = id?.trim();
    if (docId != null && docId.isNotEmpty) return docId;
    return clientMessageId?.trim() ?? '';
  }
}

/// Serialises the `POST /api/messages/send` REST-wrapper body — the Dio stand-in
/// for `sendMessageAction({conversationId, text, type, resource?, audioUrl?,
/// audioDuration?, clientMessageId?})` → `{ messageId }`.
///
/// - `senderId` is NOT sent — server-derived and pinned to the caller by the
///   action (rules enforce `senderId == auth.uid`).
/// - [clientMessageId] is a client-generated UUID that makes the send
///   **idempotent**: a retry with the same id transactionally dedups server-side
///   (no double message, no double unread increment). Always send one for an
///   offline-safe outbox.
@JsonSerializable(includeIfNull: false, createFactory: false)
class SendMessageRequestDto {
  const SendMessageRequestDto({
    required this.conversationId,
    required this.text,
    required this.type,
    this.resource,
    this.audioUrl,
    this.audioDuration,
    this.clientMessageId,
  });

  /// Typed builder that maps the domain enum → wire token and drops empty
  /// optionals, mirroring `CreateOutreachRequestDto.build`.
  factory SendMessageRequestDto.build({
    required String conversationId,
    required MessageType type,
    String text = '',
    Map<String, dynamic>? resource,
    String? audioUrl,
    int? audioDuration,
    String? clientMessageId,
  }) {
    return SendMessageRequestDto(
      conversationId: conversationId.trim(),
      text: text.trim(),
      type: type.wire,
      resource: resource,
      audioUrl: _clean(audioUrl),
      audioDuration: audioDuration,
      clientMessageId: _clean(clientMessageId),
    );
  }

  final String conversationId;
  final String text;

  /// `MessageType` wire token (`text` | `resource` | `audio`).
  final String type;

  /// The `SharedResource` payload as raw JSON when [type] is `resource`. Kept as
  /// a map (not a typed DTO) because the caller forwards an already-shaped card.
  final Map<String, dynamic>? resource;
  final String? audioUrl;
  final int? audioDuration;
  final String? clientMessageId;

  Map<String, dynamic> toJson() => _$SendMessageRequestDtoToJson(this);
}

/// Decodes `{ messageId }` — the send reply.
@JsonSerializable(createToJson: false)
class SendMessageResponseDto {
  const SendMessageResponseDto({this.messageId});

  factory SendMessageResponseDto.fromJson(Map<String, dynamic> json) =>
      _$SendMessageResponseDtoFromJson(json);

  final String? messageId;

  String get id => messageId?.trim() ?? '';
}

// ── helpers ──────────────────────────────────────────────────────────────────

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
