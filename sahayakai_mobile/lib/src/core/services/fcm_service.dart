import 'package:flutter/foundation.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:dio/dio.dart';

import '../network/api_config.dart';

/// Firebase Cloud Messaging service — registers device token with backend
/// and listens for token refreshes.
class FCMService {
  FCMService._();

  /// Initialise FCM: fetch token, register with backend, and listen for
  /// token refreshes. Call once after sign-in completes.
  static Future<void> init() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await registerToken(token);
      }

      // Re-register whenever the token is rotated.
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        registerToken(newToken);
      });
    } catch (e) {
      debugPrint('[FCMService] init error: $e');
    }
  }

  /// Register the FCM device token with the backend.
  ///
  /// Call this after Firebase init and user sign-in.
  static Future<void> registerToken(String fcmToken) async {
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    final authToken = await user.getIdToken();
    if (authToken == null) return;

    try {
      await Dio().post(
        '${ApiConfig.baseUrl}/fcm/register',
        data: {'token': fcmToken},
        options: Options(headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $authToken',
        }),
      );
    } catch (_) {
      // Silently fail — FCM registration is best-effort.
    }
  }
}
