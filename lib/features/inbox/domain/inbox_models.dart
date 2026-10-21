import 'package:flutter/foundation.dart';

import 'conversation_id.dart';

/// Whether a conversation is a 1:1 DM or a small group.
///
/// Mirrors `src/types/messages.ts::ConversationType` (`'direct' | 'group'`).
/// [fromWire] is tolerant (null / unknown → [direct]) so a decode never throws;
/// `direct` is the safe default because a malformed conversation with a 2-uid
/// participant list renders correctly as a DM.
enum ConversationType {
  direct('direct'),
  group('group');

  const ConversationType(this.wire);

  final String wire;

  static ConversationType fromWire(String? wire) {
    for (final t in ConversationType.values) {
      if (t.wire == wire) return t;
    }
    return ConversationType.direct;
  }
}

/// The kind of a message body.
///
/// Mirrors `src/types/messages.ts::MessageType` (`'text' | 'resource' |
/// 'audio'`). [fromWire] tolerant → [text] (the safe default: an unknown type
/// still renders its `text` field as a plain line).
enum MessageType {
  text('text'),
  resource('resource'),
  audio('audio');

  const MessageType(this.wire);

  final String wire;

  static MessageType fromWire(String? wire) {
    for (final t in MessageType.values) {
      if (t.wire == wire) return t;
    }
    return MessageType.text;
  }
}

/// The optimistic + server delivery state of a message.
///
/// Mirrors `src/types/messages.ts::Message.deliveryStatus`
/// (`'sending' | 'sent' | 'delivered' | 'read' | 'failed'`). Drives the
/// tick/retry affordance (B3.2). [fromWire] tolerant → [sent] (a message that
/// exists on the server but carries no status has, at minimum, been sent).
enum MessageDeliveryStatus {
  sending('sending'),
  sent('sent'),
  delivered('delivered'),
  read('read'),
  failed('failed');

  const MessageDeliveryStatus(this.wire);

  final String wire;

  static MessageDeliveryStatus fromWire(String? wire) {
    for (final s in MessageDeliveryStatus.values) {
      if (s.wire == wire) return s;
    }
    return MessageDeliveryStatus.sent;
  }

  /// The send is still in flight (optimistic) — U-SI1 shows a pending tick.
  bool get isPending => this == MessageDeliveryStatus.sending;

  /// The send failed — U-SI1 shows an inline retry.
  bool get isFailed => this == MessageDeliveryStatus.failed;
}

/// The tool a shared-resource message re-opens.
///
/// Mirrors `src/types/messages.ts::SharedResource.type`. [fromWire] tolerant →
/// [lessonPlan] (any shared card is at least openable as a document). The
/// [route] is authoritative for navigation; this enum is for the doc-type label
/// + glyph. Wire tokens are hyphenated to match the web verbatim.
enum SharedResourceKind {
  lessonPlan('lesson-plan'),
  quiz('quiz'),
  worksheet('worksheet'),
  visualAid('visual-aid'),
  rubric('rubric'),
  virtualFieldTrip('virtual-field-trip'),
  teacherTraining('teacher-training');

  const SharedResourceKind(this.wire);

  final String wire;

  static SharedResourceKind fromWire(String? wire) {
    for (final k in SharedResourceKind.values) {
      if (k.wire == wire) return k;
    }
    return SharedResourceKind.lessonPlan;
  }
}

/// A lesson-plan / quiz / worksheet card shared into a thread — the
/// Inbox↔Prep-desk bridge (`src/types/messages.ts::SharedResource`).
@immutable
class SharedResource {
  const SharedResource({
    required this.id,
    required this.kind,
    required this.title,
    required this.route,
    this.gradeLevel,
    this.subject,
    this.language,
  });

  final String id;
  final SharedResourceKind kind;
  final String title;

  /// The tool route used to build the "Open" link (e.g. `'lesson-planner'`).
  final String route;
  final String? gradeLevel;
  final String? subject;
  final String? language;

  @override
  bool operator ==(Object other) =>
      other is SharedResource &&
      other.id == id &&
      other.kind == kind &&
      other.title == title &&
      other.route == route &&
      other.gradeLevel == gradeLevel &&
      other.subject == subject &&
      other.language == language;

  @override
  int get hashCode =>
      Object.hash(id, kind, title, route, gradeLevel, subject, language);
}

/// Denormalized participant info so the inbox renders without a per-row user
/// read (`src/types/messages.ts::ParticipantSnapshot`).
@immutable
class ParticipantSnapshot {
  const ParticipantSnapshot({
    required this.displayName,
    this.photoURL,
    this.preferredLanguage,
  });

  final String displayName;
  final String? photoURL;
  final String? preferredLanguage;

  @override
  bool operator ==(Object other) =>
      other is ParticipantSnapshot &&
      other.displayName == displayName &&
      other.photoURL == photoURL &&
      other.preferredLanguage == preferredLanguage;

  @override
  int get hashCode => Object.hash(displayName, photoURL, preferredLanguage);
}

/// A single message inside `conversations/{id}/messages`
/// (`src/types/messages.ts::Message`). Read via a live `onSnapshot` tail; the
/// content fields are authored-once and never client-mutable after create
/// (`firestore.rules` only lets participants stamp `readBy`/`deliveredTo`).
@immutable
class Message {
  const Message({
    required this.id,
    required this.type,
    required this.text,
    required this.senderId,
    required this.senderName,
    this.senderPhotoURL,
    this.resource,
    this.audioUrl,
    this.audioDuration,
    this.readBy = const <String>[],
    this.deliveredTo = const <String>[],
    this.createdAt,
    this.clientMessageId,
    this.deliveryStatus,
  });

  /// Firestore doc id. For an idempotent send this equals [clientMessageId].
  final String id;
  final MessageType type;

  /// Plain text, or the caption for a resource share.
  final String text;
  final String senderId;
  final String senderName;
  final String? senderPhotoURL;

  /// Present only when [type] is [MessageType.resource].
  final SharedResource? resource;

  /// Firebase Storage https URL — present only when [type] is
  /// [MessageType.audio].
  final String? audioUrl;

  /// Voice-note duration in seconds (0–600).
  final int? audioDuration;

  /// UIDs that have opened this message — drives read ticks.
  final List<String> readBy;

  /// UIDs the message was delivered to — drives delivery ticks.
  final List<String> deliveredTo;

  /// ISO-8601 string on read; null on an optimistic pre-server message.
  final String? createdAt;

  /// The UUID that makes a send idempotent (`OutboxMessage` dedup).
  final String? clientMessageId;

  /// Optimistic/derived delivery state; null when the server carried none.
  final MessageDeliveryStatus? deliveryStatus;

  bool get isResource => type == MessageType.resource;
  bool get isAudio => type == MessageType.audio;

  /// Whether [uid] has read this message (a filled read tick for the sender).
  bool isReadBy(String uid) => readBy.contains(uid);

  @override
  bool operator ==(Object other) =>
      other is Message &&
      other.id == id &&
      other.type == type &&
      other.text == text &&
      other.senderId == senderId &&
      other.senderName == senderName &&
      other.senderPhotoURL == senderPhotoURL &&
      other.resource == resource &&
      other.audioUrl == audioUrl &&
      other.audioDuration == audioDuration &&
      listEquals(other.readBy, readBy) &&
      listEquals(other.deliveredTo, deliveredTo) &&
      other.createdAt == createdAt &&
      other.clientMessageId == clientMessageId &&
      other.deliveryStatus == deliveryStatus;

  @override
  int get hashCode => Object.hash(
        id,
        type,
        text,
        senderId,
        senderName,
        senderPhotoURL,
        resource,
        audioUrl,
        audioDuration,
        Object.hashAll(readBy),
        Object.hashAll(deliveredTo),
        createdAt,
        clientMessageId,
        deliveryStatus,
      );
}

/// A conversation document (`conversations` collection —
/// `src/types/messages.ts::Conversation`). The inbox list is a live
/// `onSnapshot` of these, filtered `participantIds array-contains me`, ordered
/// by `lastMessageAt desc`.
@immutable
class Conversation {
  const Conversation({
    required this.id,
    required this.type,
    required this.participantIds,
    required this.participants,
    required this.lastMessage,
    required this.lastMessageSenderId,
    required this.unreadCount,
    this.name,
    this.groupPhotoURL,
    this.createdBy,
    this.lastMessageAt,
    this.createdAt,
    this.updatedAt,
  });

  /// The Firestore doc id, wrapped. For a DM this is deterministic
  /// ([ConversationId.direct]).
  final ConversationId id;
  final ConversationType type;

  /// ALL participant uids — drives the `array-contains` inbox query.
  final List<String> participantIds;

  /// Denormalized per-uid snapshot (name/photo/language) so a row renders with
  /// no join.
  final Map<String, ParticipantSnapshot> participants;

  /// Group display name (group conversations only).
  final String? name;
  final String? groupPhotoURL;

  /// Creator uid (group conversations only).
  final String? createdBy;

  /// Inbox preview snippet (≤80 chars).
  final String lastMessage;

  /// ISO-8601 string on read; null before the first message.
  final String? lastMessageAt;
  final String lastMessageSenderId;

  /// Per-participant unread tally (`{uid: n}`). The badge for the current user
  /// is `unreadCount[myUid]`.
  final Map<String, int> unreadCount;

  final String? createdAt;
  final String? updatedAt;

  bool get isGroup => type == ConversationType.group;

  /// The current user's unread count (0 when absent).
  int unreadFor(String myUid) => unreadCount[myUid] ?? 0;

  /// The *other* participant's snapshot in a DM (the row label + presence dot
  /// target). Returns null for a group, an empty list, or when [myUid] is the
  /// only participant.
  ParticipantSnapshot? otherParticipant(String myUid) {
    if (isGroup) return null;
    for (final uid in participantIds) {
      if (uid != myUid) return participants[uid];
    }
    return null;
  }

  /// The other participant's uid in a DM (for the presence stream / profile
  /// link). Null for a group or a degenerate participant list.
  String? otherParticipantId(String myUid) {
    if (isGroup) return null;
    for (final uid in participantIds) {
      if (uid != myUid) return uid;
    }
    return null;
  }

  @override
  bool operator ==(Object other) =>
      other is Conversation &&
      other.id == id &&
      other.type == type &&
      listEquals(other.participantIds, participantIds) &&
      mapEquals(other.participants, participants) &&
      other.name == name &&
      other.groupPhotoURL == groupPhotoURL &&
      other.createdBy == createdBy &&
      other.lastMessage == lastMessage &&
      other.lastMessageAt == lastMessageAt &&
      other.lastMessageSenderId == lastMessageSenderId &&
      mapEquals(other.unreadCount, unreadCount) &&
      other.createdAt == createdAt &&
      other.updatedAt == updatedAt;

  @override
  int get hashCode => Object.hash(
        id,
        type,
        Object.hashAll(participantIds),
        Object.hashAllUnordered(participants.keys),
        name,
        groupPhotoURL,
        createdBy,
        lastMessage,
        lastMessageAt,
        lastMessageSenderId,
        Object.hashAllUnordered(unreadCount.keys),
        createdAt,
        updatedAt,
      );
}
