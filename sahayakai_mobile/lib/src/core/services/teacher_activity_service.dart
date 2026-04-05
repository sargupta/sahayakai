import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../network/api_config.dart';

/// Logs teaching activity events to POST /teacher-activity.
///
/// Public endpoint — no auth required, but includes userId if available.
/// Used to track engagement: lesson plans created, quizzes generated, etc.
class TeacherActivityService {
  TeacherActivityService._();

  static final _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 5),
    receiveTimeout: const Duration(seconds: 5),
  ));

  /// Log a teaching activity event.
  ///
  /// [activityType] examples: 'lesson_plan_created', 'quiz_generated',
  /// 'content_shared', 'tts_used', 'stt_used', 'vidya_chat'.
  static Future<void> log({
    required String activityType,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      final userId = FirebaseAuth.instance.currentUser?.uid;

      await _dio.post(
        '${ApiConfig.baseUrl}/teacher-activity',
        data: {
          'activityType': activityType,
          if (userId != null) 'userId': userId,
          if (metadata != null) 'metadata': metadata,
          'timestamp': DateTime.now().toIso8601String(),
          'platform': 'mobile',
        },
      );
    } catch (e) {
      debugPrint('[TeacherActivity] Log failed: $e');
    }
  }
}
