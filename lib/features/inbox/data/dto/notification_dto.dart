import 'package:json_annotation/json_annotation.dart';

import '../../domain/notification_item.dart';
import 'wire_time.dart';

part 'notification_dto.g.dart';

/// Decodes a `notifications/{id}` document
/// (`src/types/index.ts::Notification`).
///
/// **Two read paths, one DTO:**
///   - one-shot list via the `getNotificationsAction` REST wrapper (ISO strings,
///     `{ id, ...data }`);
///   - live badge via `onSnapshot(notifications where recipientId==me &&
///     isRead==false)` — build the decode input as `{ 'id': doc.id, ...doc.data() }`.
///
/// `metadata` is kept raw and coerced to `Map<String,String>` so a stray
/// non-string value never crashes the bell.
@JsonSerializable(createToJson: false)
class NotificationDto {
  const NotificationDto({
    this.id,
    this.recipientId,
    this.type,
    this.title,
    this.message,
    this.senderId,
    this.senderName,
    this.senderPhotoURL,
    this.link,
    this.metadata,
    this.isRead,
    this.createdAt,
  });

  factory NotificationDto.fromJson(Map<String, dynamic> json) =>
      _$NotificationDtoFromJson(json);

  final String? id;
  final String? recipientId;
  final String? type;
  final String? title;
  final String? message;
  final String? senderId;
  final String? senderName;
  final String? senderPhotoURL;
  final String? link;
  final Map<String, dynamic>? metadata;

  /// Tolerated as `bool`, or a truthy `'true'` / number — a missing flag reads
  /// as unread (the safe default: an unseen notification stays visible).
  final dynamic isRead;
  final dynamic createdAt;

  NotificationItem toDomain() => NotificationItem(
        id: id?.trim() ?? '',
        recipientId: recipientId?.trim() ?? '',
        kind: NotificationKind.fromWire(type),
        title: title?.trim() ?? '',
        message: message?.trim() ?? '',
        isRead: _asBool(isRead),
        senderId: _clean(senderId),
        senderName: _clean(senderName),
        senderPhotoURL: _clean(senderPhotoURL),
        link: _clean(link),
        metadata: _stringMap(metadata),
        createdAt: wireTimeToIso(createdAt),
      );

  static bool _asBool(dynamic v) => switch (v) {
        final bool b => b,
        final num n => n != 0,
        'true' => true,
        _ => false,
      };
}

/// Serialises the mark-read wrappers. `markNotificationAsRead` takes an id;
/// `markAllAsRead` takes no body. Recipient is server-verified (the action
/// checks `recipientId == caller`), so nothing but the id is sent.
@JsonSerializable(createFactory: false)
class MarkNotificationReadRequestDto {
  const MarkNotificationReadRequestDto({required this.notificationId});

  final String notificationId;

  Map<String, dynamic> toJson() =>
      _$MarkNotificationReadRequestDtoToJson(this);
}

// ── helpers ──────────────────────────────────────────────────────────────────

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

Map<String, String> _stringMap(Map<String, dynamic>? raw) {
  if (raw == null) return const <String, String>{};
  final out = <String, String>{};
  raw.forEach((key, value) {
    if (value is String && value.isNotEmpty) out[key] = value;
  });
  return out;
}
