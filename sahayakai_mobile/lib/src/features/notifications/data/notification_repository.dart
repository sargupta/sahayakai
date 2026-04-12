import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/notification_models.dart';

/// Riverpod provider for [NotificationRepository].
final notificationRepositoryProvider = Provider((ref) {
  return NotificationRepository(ref.read(apiClientProvider));
});

/// FutureProvider that fetches the user's notifications.
final notificationsProvider = FutureProvider<List<AppNotification>>((ref) {
  final repository = ref.watch(notificationRepositoryProvider);
  return repository.getNotifications();
});

/// FutureProvider for the unread notification count (e.g. badge on nav bar).
final unreadNotificationCountProvider = FutureProvider<int>((ref) {
  final repository = ref.watch(notificationRepositoryProvider);
  return repository.getUnreadCount();
});

/// Repository for notification-related API calls.
class NotificationRepository {
  final ApiClient _apiClient;

  NotificationRepository(this._apiClient);

  /// GET /notifications — fetch all notifications for the authenticated user.
  ///
  /// Falls back to stub data while the backend endpoint is under development.
  Future<List<AppNotification>> getNotifications() async {
    try {
      final response = await _apiClient.client.get('/notifications');
      if (response.statusCode == 200) {
        final data = response.data as List<dynamic>;
        return data
            .map((e) =>
                AppNotification.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {
      // Backend endpoint may not be ready yet — return stub data.
    }

    return _stubNotifications();
  }

  /// POST /notifications/{id}/read — mark a single notification as read.
  Future<void> markAsRead(String id) async {
    try {
      await _apiClient.client.post('/notifications/$id/read');
    } catch (_) {
      // Silently succeed for dev mode when backend is unavailable.
    }
  }

  /// POST /notifications/read-all — mark every notification as read.
  Future<void> markAllAsRead() async {
    try {
      await _apiClient.client.post('/notifications/read-all');
    } catch (_) {
      // Silently succeed for dev mode when backend is unavailable.
    }
  }

  /// GET /notifications/unread-count — returns the number of unread
  /// notifications for badge display.
  Future<int> getUnreadCount() async {
    try {
      final response =
          await _apiClient.client.get('/notifications/unread-count');
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        return data['count'] as int? ?? 0;
      }
    } catch (_) {
      // Backend endpoint may not be ready yet — return stub count.
    }

    return _stubNotifications().where((n) => !n.isRead).length;
  }

  // ---------------------------------------------------------------------------
  // Stub data for development
  // ---------------------------------------------------------------------------

  List<AppNotification> _stubNotifications() {
    final now = DateTime.now();
    return [
      AppNotification(
        id: 'notif-1',
        type: NotificationType.connectRequest,
        recipientId: 'me',
        senderId: 'user-101',
        senderName: 'Priya Sharma',
        senderPhotoURL: null,
        data: const {},
        isRead: false,
        createdAt: now.subtract(const Duration(minutes: 10)),
      ),
      AppNotification(
        id: 'notif-2',
        type: NotificationType.like,
        recipientId: 'me',
        senderId: 'user-102',
        senderName: 'Ramesh Gupta',
        senderPhotoURL: null,
        data: const {'targetTitle': 'Vedic Math Tricks'},
        isRead: false,
        createdAt: now.subtract(const Duration(hours: 1)),
      ),
      AppNotification(
        id: 'notif-3',
        type: NotificationType.comment,
        recipientId: 'me',
        senderId: 'user-103',
        senderName: 'Anjali Desai',
        senderPhotoURL: null,
        data: const {'targetTitle': 'Solar System Lesson'},
        isRead: false,
        createdAt: now.subtract(const Duration(hours: 3)),
      ),
      AppNotification(
        id: 'notif-4',
        type: NotificationType.badgeEarned,
        recipientId: 'me',
        senderId: 'system',
        senderName: 'SahayakAI',
        senderPhotoURL: null,
        data: const {'badgeName': 'Content Creator'},
        isRead: true,
        createdAt: now.subtract(const Duration(hours: 8)),
      ),
      AppNotification(
        id: 'notif-5',
        type: NotificationType.newPost,
        recipientId: 'me',
        senderId: 'user-104',
        senderName: 'Meera Krishnan',
        senderPhotoURL: null,
        data: const {'postTitle': 'Effective Board Exam Strategies'},
        isRead: true,
        createdAt: now.subtract(const Duration(days: 1)),
      ),
      AppNotification(
        id: 'notif-6',
        type: NotificationType.connectAccepted,
        recipientId: 'me',
        senderId: 'user-105',
        senderName: 'Suresh Iyer',
        senderPhotoURL: null,
        data: const {},
        isRead: true,
        createdAt: now.subtract(const Duration(days: 2)),
      ),
      AppNotification(
        id: 'notif-7',
        type: NotificationType.resourceSaved,
        recipientId: 'me',
        senderId: 'user-106',
        senderName: 'Kavita Rao',
        senderPhotoURL: null,
        data: const {'resourceTitle': 'Mughal Empire Timeline'},
        isRead: true,
        createdAt: now.subtract(const Duration(days: 3)),
      ),
      AppNotification(
        id: 'notif-8',
        type: NotificationType.follow,
        recipientId: 'me',
        senderId: 'user-107',
        senderName: 'Deepak Nair',
        senderPhotoURL: null,
        data: const {},
        isRead: true,
        createdAt: now.subtract(const Duration(days: 5)),
      ),
    ];
  }
}
