import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../network/api_config.dart';

/// Sends client-side performance metrics to POST /metrics.
///
/// Used for tracking:
/// - Screen load times
/// - API call latencies
/// - Error rates
/// - App startup duration
///
/// Metrics are fire-and-forget — failures are silently ignored.
class MetricsService {
  MetricsService._();

  static final _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 5),
    receiveTimeout: const Duration(seconds: 5),
  ));

  /// Send a performance metric to the backend.
  static Future<void> send({
    required String name,
    required double value,
    String? unit,
    Map<String, String>? tags,
  }) async {
    try {
      await _dio.post(
        '${ApiConfig.baseUrl}/metrics',
        data: {
          'name': name,
          'value': value,
          if (unit != null) 'unit': unit,
          if (tags != null) 'tags': tags,
          'platform': 'flutter',
          'timestamp': DateTime.now().toIso8601String(),
        },
      );
    } catch (e) {
      // Fire-and-forget — don't let metrics tracking crash the app.
      debugPrint('[Metrics] Send failed: $e');
    }
  }

  /// Track screen load time.
  static Future<void> trackScreenLoad(String screenName, Duration duration) {
    return send(
      name: 'screen_load',
      value: duration.inMilliseconds.toDouble(),
      unit: 'ms',
      tags: {'screen': screenName},
    );
  }

  /// Track API call latency.
  static Future<void> trackApiLatency(
      String endpoint, Duration duration, int statusCode) {
    return send(
      name: 'api_latency',
      value: duration.inMilliseconds.toDouble(),
      unit: 'ms',
      tags: {'endpoint': endpoint, 'status': statusCode.toString()},
    );
  }

  /// Track app startup time.
  static Future<void> trackStartup(Duration duration) {
    return send(
      name: 'app_startup',
      value: duration.inMilliseconds.toDouble(),
      unit: 'ms',
    );
  }

  /// Track a screen view (fire-and-forget, value is always 1).
  static Future<void> trackScreenView(String screenName) {
    return send(
      name: 'screen_view',
      value: 1,
      tags: {'screen': screenName},
    );
  }

  /// Track a generic event with optional properties.
  static Future<void> trackEvent(String eventName,
      {Map<String, dynamic>? properties}) {
    return send(
      name: eventName,
      value: 1,
      tags: properties?.map((k, v) => MapEntry(k, v.toString())),
    );
  }
}
