import 'package:flutter/foundation.dart';

/// The typed kind of a notification (`src/types/index.ts::NotificationType`).
///
/// Wire tokens mirror the union name-for-name. [fromWire] is tolerant (null /
/// unknown → [system]) so a future server type never crashes the bell — an
/// unrecognised notification still renders its title/message with a neutral
/// glyph. Note the web adds new types over time (this is a forward-compat guard).
///
/// **`MESSAGE` is included deliberately even though it is ABSENT from the
/// `NotificationType` union in `src/types/index.ts`.** `sendMessageAction`
/// (`src/app/actions/messages.ts`) writes `type: 'MESSAGE'` at runtime (and the
/// SPEC §B1.3 documents it) — the union just never listed it. Modelling it here
/// (rather than letting it fall through to [system]) is what lets the Pro-Inbox
/// notification row show the message glyph and the "open thread" deep link.
enum NotificationKind {
  message('MESSAGE'),
  follow('FOLLOW'),
  newPost('NEW_POST'),
  badgeEarned('BADGE_EARNED'),
  system('SYSTEM'),
  like('LIKE'),
  resourceSaved('RESOURCE_SAVED'),
  resourceUsed('RESOURCE_USED'),
  comment('COMMENT'),
  connectRequest('CONNECT_REQUEST'),
  connectAccepted('CONNECT_ACCEPTED'),
  newTeacherJoined('NEW_TEACHER_JOINED'),
  newGroupPost('NEW_GROUP_POST'),
  groupPostLike('GROUP_POST_LIKE');

  const NotificationKind(this.wire);

  final String wire;

  static NotificationKind fromWire(String? wire) {
    for (final k in NotificationKind.values) {
      if (k.wire == wire) return k;
    }
    return NotificationKind.system;
  }

  /// A connection request carries `metadata.requestId` and gets inline
  /// Accept/Decline actions (B3.3). Only this type unlocks those buttons.
  bool get isConnectRequest => this == NotificationKind.connectRequest;

  /// A message notification stamps `metadata.conversationId` +
  /// `link=/messages?open={id}`; opening/reading the thread clears both the
  /// conversation unread and the bell badge.
  bool get isMessage => this == NotificationKind.message;
}

/// A notification document (`notifications` collection —
/// `src/types/index.ts::Notification`). Read one-shot via
/// `getNotificationsAction` (the list) and live via an `onSnapshot`
/// (`recipientId == me && isRead == false`) for the bell badge.
@immutable
class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.recipientId,
    required this.kind,
    required this.title,
    required this.message,
    required this.isRead,
    this.senderId,
    this.senderName,
    this.senderPhotoURL,
    this.link,
    this.metadata = const <String, String>{},
    this.createdAt,
  });

  final String id;
  final String recipientId;
  final NotificationKind kind;
  final String title;
  final String message;
  final bool isRead;
  final String? senderId;
  final String? senderName;
  final String? senderPhotoURL;

  /// Deep-link target, e.g. `/messages?open={conversationId}`.
  final String? link;

  /// Typed extras, e.g. `{ requestId }` for a `CONNECT_REQUEST`, or
  /// `{ groupId, postId }` for a group-post notification.
  final Map<String, String> metadata;

  /// ISO-8601 string.
  final String? createdAt;

  /// The connection-request id for the inline Accept/Decline actions, or null
  /// when this is not a connect-request notification (or it carried no id).
  String? get requestId =>
      kind.isConnectRequest ? metadata['requestId'] : null;

  /// The conversation id a message notification points at (from metadata or the
  /// `open=` querystring in [link]), for the deep-link that opens the thread.
  String? get conversationId {
    final fromMeta = metadata['conversationId'];
    if (fromMeta != null && fromMeta.isNotEmpty) return fromMeta;
    final l = link;
    if (l == null) return null;
    // Anchor on a query delimiter (`?`/`&`) so `open=` matches a real param and
    // never false-matches a longer key like `reopen=x`.
    final match = RegExp(r'[?&]open=([^&]+)').firstMatch(l);
    return match?.group(1);
  }

  @override
  bool operator ==(Object other) =>
      other is NotificationItem &&
      other.id == id &&
      other.recipientId == recipientId &&
      other.kind == kind &&
      other.title == title &&
      other.message == message &&
      other.isRead == isRead &&
      other.senderId == senderId &&
      other.senderName == senderName &&
      other.senderPhotoURL == senderPhotoURL &&
      other.link == link &&
      mapEquals(other.metadata, metadata) &&
      other.createdAt == createdAt;

  @override
  int get hashCode => Object.hash(
        id,
        recipientId,
        kind,
        title,
        message,
        isRead,
        senderId,
        senderName,
        senderPhotoURL,
        link,
        Object.hashAllUnordered(metadata.keys),
        createdAt,
      );
}
