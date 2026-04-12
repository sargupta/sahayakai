/// Domain models for the Direct Messaging feature.
library;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/// The content type carried by a [DirectMessage].
enum MessageType {
  text,
  resource,
  audio;

  factory MessageType.fromJson(String value) =>
      MessageType.values.firstWhere(
        (e) => e.name == value,
        orElse: () => MessageType.text,
      );
}

/// Delivery lifecycle of a [DirectMessage].
enum DeliveryStatus {
  sent,
  delivered,
  read;

  factory DeliveryStatus.fromJson(String value) =>
      DeliveryStatus.values.firstWhere(
        (e) => e.name == value,
        orElse: () => DeliveryStatus.sent,
      );
}

// ---------------------------------------------------------------------------
// SharedResource
// ---------------------------------------------------------------------------

/// A reference to a resource (lesson plan, quiz, worksheet, etc.) shared
/// inside a direct message.
class SharedResource {
  final String id;
  final String title;

  /// E.g. `lessonPlan`, `quiz`, `worksheet`, `presentation`.
  final String type;
  final String? topic;
  final String? classLevel;
  final String? subject;

  const SharedResource({
    required this.id,
    required this.title,
    required this.type,
    this.topic,
    this.classLevel,
    this.subject,
  });

  factory SharedResource.fromJson(Map<String, dynamic> json) {
    return SharedResource(
      id: json['id'] as String,
      title: json['title'] as String,
      type: json['type'] as String,
      topic: json['topic'] as String?,
      classLevel: json['classLevel'] as String?,
      subject: json['subject'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'type': type,
        if (topic != null) 'topic': topic,
        if (classLevel != null) 'classLevel': classLevel,
        if (subject != null) 'subject': subject,
      };
}

// ---------------------------------------------------------------------------
// DirectMessage
// ---------------------------------------------------------------------------

/// A single message within a [Conversation].
class DirectMessage {
  final String id;
  final String conversationId;
  final String authorId;
  final String authorName;
  final String? authorPhotoURL;
  final String text;
  final MessageType type;
  final SharedResource? resource;
  final String? audioUrl;
  final int? audioDurationMs;
  final DateTime createdAt;
  final DeliveryStatus deliveryStatus;

  const DirectMessage({
    required this.id,
    required this.conversationId,
    required this.authorId,
    required this.authorName,
    this.authorPhotoURL,
    required this.text,
    this.type = MessageType.text,
    this.resource,
    this.audioUrl,
    this.audioDurationMs,
    required this.createdAt,
    this.deliveryStatus = DeliveryStatus.sent,
  });

  factory DirectMessage.fromJson(Map<String, dynamic> json) {
    return DirectMessage(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String,
      authorId: json['authorId'] as String,
      authorName: json['authorName'] as String,
      authorPhotoURL: json['authorPhotoURL'] as String?,
      text: json['text'] as String? ?? '',
      type: MessageType.fromJson(json['type'] as String? ?? 'text'),
      resource: json['resource'] != null
          ? SharedResource.fromJson(json['resource'] as Map<String, dynamic>)
          : null,
      audioUrl: json['audioUrl'] as String?,
      audioDurationMs: json['audioDurationMs'] as int?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      deliveryStatus: DeliveryStatus.fromJson(
        json['deliveryStatus'] as String? ?? 'sent',
      ),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'conversationId': conversationId,
        'authorId': authorId,
        'authorName': authorName,
        if (authorPhotoURL != null) 'authorPhotoURL': authorPhotoURL,
        'text': text,
        'type': type.name,
        if (resource != null) 'resource': resource!.toJson(),
        if (audioUrl != null) 'audioUrl': audioUrl,
        if (audioDurationMs != null) 'audioDurationMs': audioDurationMs,
        'createdAt': createdAt.toIso8601String(),
        'deliveryStatus': deliveryStatus.name,
      };
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

/// A direct-message conversation between two or more participants.
class Conversation {
  final String id;
  final List<String> participantIds;

  /// Maps participant UID to display name.
  final Map<String, String> participantNames;

  /// Maps participant UID to photo URL (nullable per participant).
  final Map<String, String?> participantPhotos;

  final String? lastMessage;
  final DateTime? lastMessageAt;

  /// Maps participant UID to their unread message count.
  final Map<String, int> unreadCounts;

  const Conversation({
    required this.id,
    required this.participantIds,
    this.participantNames = const {},
    this.participantPhotos = const {},
    this.lastMessage,
    this.lastMessageAt,
    this.unreadCounts = const {},
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] as String,
      participantIds: List<String>.from(json['participantIds'] as List),
      participantNames: (json['participantNames'] as Map<String, dynamic>?)
              ?.map((k, v) => MapEntry(k, v as String)) ??
          const {},
      participantPhotos: (json['participantPhotos'] as Map<String, dynamic>?)
              ?.map((k, v) => MapEntry(k, v as String?)) ??
          const {},
      lastMessage: json['lastMessage'] as String?,
      lastMessageAt: json['lastMessageAt'] != null
          ? DateTime.parse(json['lastMessageAt'] as String)
          : null,
      unreadCounts: (json['unreadCounts'] as Map<String, dynamic>?)
              ?.map((k, v) => MapEntry(k, (v as num).toInt())) ??
          const {},
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'participantIds': participantIds,
        'participantNames': participantNames,
        'participantPhotos': participantPhotos,
        if (lastMessage != null) 'lastMessage': lastMessage,
        if (lastMessageAt != null)
          'lastMessageAt': lastMessageAt!.toIso8601String(),
        'unreadCounts': unreadCounts,
      };
}
