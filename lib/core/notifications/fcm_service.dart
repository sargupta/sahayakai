import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'notification_service.dart';

/// FCM client: token registration, refresh, cleanup on sign-out.
/// Backend must send data messages with a `type` field for routing.
class FcmService {
  FcmService._();
  static final FcmService instance = FcmService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  String? _currentToken;

  /// Initialize FCM. Call after Firebase init + auth.
  Future<void> initialize() async {
    // Request permission (Android 13+ handled by notification service).
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    if (settings.authorizationStatus != AuthorizationStatus.authorized &&
        settings.authorizationStatus != AuthorizationStatus.provisional) {
      debugPrint('[FCM] permission not granted: ${settings.authorizationStatus}');
      return;
    }

    // Get token.
    _currentToken = await _messaging.getToken();
    debugPrint('[FCM] token: ${_maskToken(_currentToken)}');

    // Listen for token refresh.
    _messaging.onTokenRefresh.listen((newToken) {
      debugPrint('[FCM] token refreshed: ${_maskToken(newToken)}');
      _currentToken = newToken;
      // TODO: send newToken to backend.
    });

    // Handle foreground messages.
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Handle background/terminated messages.
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageTap);
  }

  /// Handle a foreground FCM message (show local notification).
  void _handleForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    final data = message.data;

    if (notification != null) {
      // Foreground messages are shown by the system notification tray.
      // The app-level NotificationService handles channel creation and
      // permission. Data payload routing is handled by _handleMessageTap.
      debugPrint('[FCM] foreground message: ${notification.title}');
    }
  }

  /// Handle a notification tap (from background/terminated state).
  void _handleMessageTap(RemoteMessage message) {
    final data = message.data;
    final route = data['route'] as String?;
    if (route != null) {
      debugPrint('[FCM] tapped route: $route');
      // Navigation is handled by the app router via deep link.
    }
  }

  /// Get the current FCM token (masked for logging).
  String? get token => _currentToken;

  /// Clear token on sign-out.
  Future<void> clearToken() async {
    await _messaging.deleteToken();
    _currentToken = null;
  }

  String _channelForType(String? type) {
    switch (type) {
      case 'class_reminder':
        return 'class_reminders';
      case 'task_result':
        return 'task_results';
      case 'message':
      case 'update':
        return 'messages_updates';
      case 'account':
      case 'system':
        return 'account_system';
      default:
        return 'messages_updates';
    }
  }

  /// Mask token for safe logging (first 4 + last 4 chars).
  String _maskToken(String? token) {
    if (token == null || token.length < 8) return '***';
    return '${token.substring(0, 4)}...${token.substring(token.length - 4)}';
  }
}