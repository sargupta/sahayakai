import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../network/api_config.dart';

/// Admin utility: POST /analytics/seed — seeds demo analytics data.
///
/// Only used in development/debug mode for testing the impact dashboard.
class AnalyticsSeedService {
  AnalyticsSeedService._();

  static final _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 30),
  ));

  /// Seed demo analytics data for a user (admin/testing only).
  ///
  /// Returns true on success, false on failure.
  static Future<bool> seed(String userId) async {
    if (!kDebugMode) {
      debugPrint('[AnalyticsSeed] Skipped — not in debug mode');
      return false;
    }

    try {
      final response = await _dio.post(
        '${ApiConfig.baseUrl}/analytics/seed',
        data: {'userId': userId},
      );
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('[AnalyticsSeed] Failed: $e');
      return false;
    }
  }
}
