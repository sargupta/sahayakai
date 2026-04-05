import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_config.dart';

/// Health check response from GET /health.
class HealthStatus {
  final String status; // 'ok' | 'degraded' | 'down'
  final String? version;
  final String? environment;

  const HealthStatus({
    required this.status,
    this.version,
    this.environment,
  });

  bool get isHealthy => status == 'ok';

  factory HealthStatus.fromJson(Map<String, dynamic> json) => HealthStatus(
        status: json['status'] as String? ?? 'unknown',
        version: json['version'] as String?,
        environment: json['environment'] as String?,
      );
}

/// Quiz pipeline health from GET /ai/quiz/health.
class QuizHealthStatus {
  final String status;
  final Map<String, dynamic>? diagnostics;

  const QuizHealthStatus({required this.status, this.diagnostics});

  factory QuizHealthStatus.fromJson(Map<String, dynamic> json) =>
      QuizHealthStatus(
        status: json['status'] as String? ?? 'unknown',
        diagnostics: json['diagnostics'] as Map<String, dynamic>?,
      );
}

class HealthService {
  HealthService._();

  static final _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 5),
    receiveTimeout: const Duration(seconds: 5),
  ));

  /// Check if the backend is reachable and healthy.
  /// Used for connectivity verification beyond simple network checks.
  static Future<HealthStatus> checkBackendHealth() async {
    try {
      final response = await _dio.get('${ApiConfig.baseUrl}/health');
      if (response.statusCode == 200) {
        return HealthStatus.fromJson(response.data as Map<String, dynamic>);
      }
      return const HealthStatus(status: 'degraded');
    } catch (_) {
      return const HealthStatus(status: 'down');
    }
  }

  /// Check quiz generation pipeline health.
  static Future<QuizHealthStatus> checkQuizHealth() async {
    try {
      final response = await _dio.get('${ApiConfig.baseUrl}/ai/quiz/health');
      if (response.statusCode == 200) {
        return QuizHealthStatus.fromJson(
            response.data as Map<String, dynamic>);
      }
      return const QuizHealthStatus(status: 'degraded');
    } catch (_) {
      return const QuizHealthStatus(status: 'down');
    }
  }
}

/// Provider: backend health status (auto-refresh on watch).
final backendHealthProvider = FutureProvider.autoDispose<HealthStatus>((ref) {
  return HealthService.checkBackendHealth();
});
