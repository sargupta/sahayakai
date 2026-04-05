/// Domain models for the Notifications feature.

/// The kind of notification event.
enum NotificationType {
  follow,
  newPost,
  badgeEarned,
  like,
  resourceSaved,
  comment,
  connectRequest,
  connectAccepted;

  /// Human-readable label for display purposes.
  String get displayName {
    switch (this) {
      case NotificationType.follow:
        return 'Follow';
      case NotificationType.newPost:
        return 'New Post';
      case NotificationType.badgeEarned:
        return 'Badge Earned';
      case NotificationType.like:
        return 'Like';
      case NotificationType.resourceSaved:
        return 'Resource Saved';
      case NotificationType.comment:
        return 'Comment';
      case NotificationType.connectRequest:
        return 'Connection Request';
      case NotificationType.connectAccepted:
        return 'Connection Accepted';
    }
  }
}

/// A single in-app notification.
class AppNotification {
  final String id;
  final NotificationType type;
  final String recipientId;
  final String senderId;
  final String senderName;
  final String? senderPhotoURL;
  final Map<String, dynamic> data;
  final bool isRead;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.type,
    required this.recipientId,
    required this.senderId,
    required this.senderName,
    this.senderPhotoURL,
    this.data = const {},
    this.isRead = false,
    required this.createdAt,
  });

  /// Human-readable notification message based on [type] and [data].
  String get message {
    switch (type) {
      case NotificationType.follow:
        return '$senderName started following you.';
      case NotificationType.newPost:
        final title = data['postTitle'] as String? ?? 'a post';
        return '$senderName published "$title".';
      case NotificationType.badgeEarned:
        final badge = data['badgeName'] as String? ?? 'a badge';
        return 'You earned the "$badge" badge!';
      case NotificationType.like:
        final target = data['targetTitle'] as String? ?? 'your content';
        return '$senderName liked $target.';
      case NotificationType.resourceSaved:
        final resource = data['resourceTitle'] as String? ?? 'your resource';
        return '$senderName saved $resource.';
      case NotificationType.comment:
        final target = data['targetTitle'] as String? ?? 'your post';
        return '$senderName commented on $target.';
      case NotificationType.connectRequest:
        return '$senderName sent you a connection request.';
      case NotificationType.connectAccepted:
        return '$senderName accepted your connection request.';
    }
  }

  /// Returns a copy with the given fields replaced.
  AppNotification copyWith({
    String? id,
    NotificationType? type,
    String? recipientId,
    String? senderId,
    String? senderName,
    String? senderPhotoURL,
    Map<String, dynamic>? data,
    bool? isRead,
    DateTime? createdAt,
  }) {
    return AppNotification(
      id: id ?? this.id,
      type: type ?? this.type,
      recipientId: recipientId ?? this.recipientId,
      senderId: senderId ?? this.senderId,
      senderName: senderName ?? this.senderName,
      senderPhotoURL: senderPhotoURL ?? this.senderPhotoURL,
      data: data ?? this.data,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      type: NotificationType.values.firstWhere(
        (t) => t.name == json['type'],
        orElse: () => NotificationType.follow,
      ),
      recipientId: json['recipientId'] as String? ?? '',
      senderId: json['senderId'] as String? ?? '',
      senderName: json['senderName'] as String? ?? 'Someone',
      senderPhotoURL: json['senderPhotoURL'] as String?,
      data: (json['data'] as Map<String, dynamic>?) ?? const {},
      isRead: json['isRead'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'recipientId': recipientId,
        'senderId': senderId,
        'senderName': senderName,
        'senderPhotoURL': senderPhotoURL,
        'data': data,
        'isRead': isRead,
        'createdAt': createdAt.toIso8601String(),
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AppNotification &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() =>
      'AppNotification(id: $id, type: ${type.name}, isRead: $isRead)';
}
