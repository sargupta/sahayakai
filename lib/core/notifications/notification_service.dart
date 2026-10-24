import 'dart:io';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';

/// Core notification service: permission, FCM token, channel management.
/// Singleton — initialize once at startup.
///
/// NOTE: Full local notification scheduling (flutter_local_notifications)
/// requires a dependency that couldn't be resolved offline. This service
/// handles FCM push notifications and permission flow. Local scheduling will
/// be added when the dependency is available.
class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  bool _initialized = false;

  /// Initialize the notification service. Call once at app startup.
  Future<void> initialize() async {
    if (_initialized) return;

    // Listen for token refresh.
    _messaging.onTokenRefresh.listen((newToken) {
      debugPrint('[FCM] token refreshed: ${_maskToken(newToken)}');
    });

    _initialized = true;
  }

  /// Request notification permission (Android 13+). Returns true if granted.
  Future<bool> requestPermission() async {
    if (!Platform.isAndroid) return true;
    final status = await Permission.notification.request();
    return status.isGranted;
  }

  /// Check if notification permission is granted.
  Future<bool> isPermissionGranted() async {
    if (!Platform.isAndroid) return true;
    final status = await Permission.notification.status;
    return status.isGranted;
  }

  /// Open system notification settings.
  Future<void> openSystemSettings() async {
    await openAppSettings();
  }

  /// Get the current FCM token (masked for logging).
  Future<String?> getToken() async {
    try {
      return await _messaging.getToken();
    } catch (e) {
      debugPrint('[FCM] getToken failed: $e');
      return null;
    }
  }

  /// Clear token on sign-out.
  Future<void> clearToken() async {
    await _messaging.deleteToken();
  }

  /// Mask token for safe logging (first 4 + last 4 chars).
  String _maskToken(String? token) {
    if (token == null || token.length < 8) return '***';
    return '${token.substring(0, 4)}...${token.substring(token.length - 4)}';
  }
}