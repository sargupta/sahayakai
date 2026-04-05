import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_config.dart';

final teacherHealthRepositoryProvider = Provider((ref) {
  return TeacherHealthRepository();
});

/// Teacher engagement and health metrics from
/// GET /analytics/teacher-health/[userId].
class TeacherHealthScore {
  final double healthScore; // 0-100
  final Map<String, dynamic>? breakdown;
  final String? tier; // e.g., 'active', 'at-risk', 'dormant'

  const TeacherHealthScore({
    required this.healthScore,
    this.breakdown,
    this.tier,
  });

  factory TeacherHealthScore.fromJson(Map<String, dynamic> json) =>
      TeacherHealthScore(
        healthScore: (json['healthScore'] as num?)?.toDouble() ?? 0,
        breakdown: json['breakdown'] as Map<String, dynamic>?,
        tier: json['tier'] as String?,
      );
}

class TeacherHealthRepository {
  final Dio _dio;

  TeacherHealthRepository({Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: ApiConfig.baseUrl,
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 10),
            ));

  /// GET /analytics/teacher-health/{userId} — public endpoint.
  Future<TeacherHealthScore> getHealthScore(String userId) async {
    final response = await _dio.get('/analytics/teacher-health/$userId');
    if (response.statusCode == 200) {
      return TeacherHealthScore.fromJson(
          response.data as Map<String, dynamic>);
    }
    throw Exception('Health score fetch failed: ${response.statusCode}');
  }
}
