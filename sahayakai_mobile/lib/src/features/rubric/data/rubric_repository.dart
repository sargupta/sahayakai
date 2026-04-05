import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

final rubricRepositoryProvider = Provider((ref) {
  return RubricRepository(ref.read(apiClientProvider));
});

/// Response model for POST /ai/rubric.
class RubricOutput {
  final String title;
  final String description;
  final List<RubricCriterion> criteria;
  final String? gradeLevel;
  final String? subject;

  const RubricOutput({
    required this.title,
    required this.description,
    required this.criteria,
    this.gradeLevel,
    this.subject,
  });

  factory RubricOutput.fromJson(Map<String, dynamic> json) {
    return RubricOutput(
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      criteria: (json['criteria'] as List<dynamic>?)
              ?.map((c) => RubricCriterion.fromJson(c as Map<String, dynamic>))
              .toList() ??
          [],
      gradeLevel: json['gradeLevel'] as String?,
      subject: json['subject'] as String?,
    );
  }
}

class RubricCriterion {
  final String name;
  final String description;
  final List<RubricLevel> levels;

  const RubricCriterion({
    required this.name,
    required this.description,
    required this.levels,
  });

  factory RubricCriterion.fromJson(Map<String, dynamic> json) {
    return RubricCriterion(
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      levels: (json['levels'] as List<dynamic>?)
              ?.map((l) => RubricLevel.fromJson(l as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class RubricLevel {
  final String name;
  final String description;
  final int points;

  const RubricLevel({
    required this.name,
    required this.description,
    required this.points,
  });

  factory RubricLevel.fromJson(Map<String, dynamic> json) {
    return RubricLevel(
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      points: json['points'] as int? ?? 0,
    );
  }
}

class RubricRepository {
  final ApiClient _apiClient;

  RubricRepository(this._apiClient);

  Future<RubricOutput> generate({
    required String assignmentDescription,
    String? gradeLevel,
    String? language,
    String? subject,
  }) async {
    final response = await _apiClient.client.post(
      '/ai/rubric',
      data: {
        'assignmentDescription': assignmentDescription,
        if (gradeLevel != null) 'gradeLevel': gradeLevel,
        if (language != null) 'language': language,
        if (subject != null) 'subject': subject,
      },
    );

    return RubricOutput.fromJson(response.data as Map<String, dynamic>);
  }
}
