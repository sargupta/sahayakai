import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

final trainingRepositoryProvider = Provider((ref) {
  return TrainingRepository(ref.read(apiClientProvider));
});

/// Response model for POST /ai/teacher-training.
class TrainingOutput {
  final String introduction;
  final List<TrainingAdvice> advice;
  final String conclusion;
  final String? gradeLevel;
  final String? subject;

  const TrainingOutput({
    required this.introduction,
    required this.advice,
    required this.conclusion,
    this.gradeLevel,
    this.subject,
  });

  factory TrainingOutput.fromJson(Map<String, dynamic> json) {
    return TrainingOutput(
      introduction: json['introduction'] as String? ?? '',
      advice: (json['advice'] as List<dynamic>?)
              ?.map((a) => TrainingAdvice.fromJson(a as Map<String, dynamic>))
              .toList() ??
          [],
      conclusion: json['conclusion'] as String? ?? '',
      gradeLevel: json['gradeLevel'] as String?,
      subject: json['subject'] as String?,
    );
  }
}

class TrainingAdvice {
  final String strategy;
  final String pedagogy;
  final String explanation;

  const TrainingAdvice({
    required this.strategy,
    required this.pedagogy,
    required this.explanation,
  });

  factory TrainingAdvice.fromJson(Map<String, dynamic> json) {
    return TrainingAdvice(
      strategy: json['strategy'] as String? ?? '',
      pedagogy: json['pedagogy'] as String? ?? '',
      explanation: json['explanation'] as String? ?? '',
    );
  }
}

class TrainingRepository {
  final ApiClient _apiClient;

  TrainingRepository(this._apiClient);

  Future<TrainingOutput> generate({
    required String question,
    String? language,
    String? subject,
  }) async {
    final response = await _apiClient.client.post(
      '/ai/teacher-training',
      data: {
        'question': question,
        if (language != null) 'language': language,
        if (subject != null) 'subject': subject,
      },
    );

    if (response.statusCode == 200) {
      return TrainingOutput.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('Training generation failed: ${response.statusCode}');
  }
}
