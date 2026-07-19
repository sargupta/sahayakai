import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/firebase/firebase_init.dart';
import '../domain/notification_item.dart';
import 'block_c_transport.dart';

part 'notifications_transport.g.dart';

/// # NotificationsTransport — the bell (Pillar 05)
///
/// The contract U-SI5 builds the notifications screen + live bell badge against.
/// Live badge = Firestore `onSnapshot`; the list + mark-read = REST wrappers.
abstract interface class NotificationsTransport {
  /// **LIVE.** The unread bell badge. Real impl:
  /// `onSnapshot(collection('notifications')
  ///   .where('recipientId', isEqualTo: myUid)
  ///   .where('isRead', isEqualTo: false))`, mapped via [NotificationDto].
  /// A missing index / permission-denied → `TransportSnapshot.error`, never a
  /// hang.
  Stream<TransportSnapshot<List<NotificationItem>>> watchUnreadNotifications();

  /// **LIVE.** The unread *count* for the badge pill — the same snapshot as
  /// [watchUnreadNotifications], reduced to its length.
  Stream<TransportSnapshot<int>> watchUnreadNotificationCount();

  /// **ONE-SHOT.** The notifications list (≤50, in-memory sorted). REST wrapper
  /// of `getNotificationsAction()`. Poll/refresh; the badge is the live source.
  Future<List<NotificationItem>> getNotifications();

  /// **WRITE.** REST wrapper of `markNotificationAsReadAction(id)`
  /// (recipient-verified).
  Future<void> markNotificationRead(String notificationId);

  /// **WRITE.** REST wrapper of `markAllAsReadAction()` (chunked ≤500/batch).
  Future<void> markAllNotificationsRead();
}

/// The default, Firebase-free implementation (U-SI0). Live streams emit one
/// `awaitingFirebase` snapshot; the one-shot list returns empty; writes throw
/// [TransportUnavailable].
class DeferredNotificationsTransport implements NotificationsTransport {
  const DeferredNotificationsTransport();

  @override
  Stream<TransportSnapshot<List<NotificationItem>>>
      watchUnreadNotifications() =>
          Stream<TransportSnapshot<List<NotificationItem>>>.value(
            const TransportSnapshot<List<NotificationItem>>.awaitingFirebase(
              <NotificationItem>[],
            ),
          );

  @override
  Stream<TransportSnapshot<int>> watchUnreadNotificationCount() =>
      Stream<TransportSnapshot<int>>.value(
        const TransportSnapshot<int>.awaitingFirebase(0),
      );

  @override
  Future<List<NotificationItem>> getNotifications() async =>
      const <NotificationItem>[];

  @override
  Future<void> markNotificationRead(String notificationId) async =>
      throw const TransportUnavailable.awaitingFirebase(
        'markNotificationRead',
      );

  @override
  Future<void> markAllNotificationsRead() async =>
      throw const TransportUnavailable.awaitingFirebase(
        'markAllNotificationsRead',
      );
}

@Riverpod(keepAlive: true)
NotificationsTransport notificationsTransport(Ref ref) {
  if (FirebaseInit.isConfigured) {
    throw StateError(
      'Firebase is configured but the live NotificationsTransport is not wired. '
      'Bind FirestoreNotificationsTransport as part of the Block C handoff.',
    );
  }
  return const DeferredNotificationsTransport();
}
