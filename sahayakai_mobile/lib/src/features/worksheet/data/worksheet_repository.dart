import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

final worksheetRepositoryProvider = Provider((ref) {
  return WorksheetRepository(ref.read(apiClientProvider));
});

/// Response model for POST /ai/worksheet.
class WorksheetOutput {
  final String title;
  final String gradeLevel;
  final String subject;
  final List<String> learningObjectives;
  final String studentInstructions;
  final List<WorksheetActivity> activities;
  final List<AnswerKeyItem> answerKey;
  final String worksheetContent; // Full markdown

  const WorksheetOutput({
    required this.title,
    required this.gradeLevel,
    required this.subject,
    required this.learningObjectives,
    required this.studentInstructions,
    required this.activities,
    required this.answerKey,
    required this.worksheetContent,
  });

  factory WorksheetOutput.fromJson(Map<String, dynamic> json) {
    return WorksheetOutput(
      title: json['title'] as String? ?? '',
      gradeLevel: json['gradeLevel'] as String? ?? '',
      subject: json['subject'] as String? ?? '',
      learningObjectives: List<String>.from(json['learningObjectives'] ?? []),
      studentInstructions: json['studentInstructions'] as String? ?? '',
      activities: (json['activities'] as List<dynamic>?)
              ?.map((a) => WorksheetActivity.fromJson(a as Map<String, dynamic>))
              .toList() ??
          [],
      answerKey: (json['answerKey'] as List<dynamic>?)
              ?.map((a) => AnswerKeyItem.fromJson(a as Map<String, dynamic>))
              .toList() ??
          [],
      worksheetContent: json['worksheetContent'] as String? ?? '',
    );
  }
}

class WorksheetActivity {
  final String type;
  final String content;
  final String explanation;
  final String? chalkboardNote;

  const WorksheetActivity({
    required this.type,
    required this.content,
    required this.explanation,
    this.chalkboardNote,
  });

  factory WorksheetActivity.fromJson(Map<String, dynamic> json) {
    return WorksheetActivity(
      type: json['type'] as String? ?? '',
      content: json['content'] as String? ?? '',
      explanation: json['explanation'] as String? ?? '',
      chalkboardNote: json['chalkboardNote'] as String?,
    );
  }
}

class AnswerKeyItem {
  final int activityIndex;
  final String answer;

  const AnswerKeyItem({required this.activityIndex, required this.answer});

  factory AnswerKeyItem.fromJson(Map<String, dynamic> json) {
    return AnswerKeyItem(
      activityIndex: json['activityIndex'] as int? ?? 0,
      answer: json['answer'] as String? ?? '',
    );
  }
}

class WorksheetRepository {
  final ApiClient _apiClient;

  WorksheetRepository(this._apiClient);

  /// Generate a worksheet via the dedicated endpoint.
  ///
  /// [prompt] is required. [imageDataUri] is technically required by the backend
  /// but we send an empty string if no image is provided (backend handles fallback).
  Future<WorksheetOutput> generate({
    required String prompt,
    String? imageDataUri,
    String? gradeLevel,
    String? language,
    String? subject,
  }) async {
    final response = await _apiClient.client.post(
      '/ai/worksheet',
      data: {
        'prompt': prompt,
        'imageDataUri': imageDataUri ?? '',
        if (gradeLevel != null) 'gradeLevel': gradeLevel,
        if (language != null) 'language': language,
        if (subject != null) 'subject': subject,
      },
    );

    return WorksheetOutput.fromJson(response.data as Map<String, dynamic>);
  }
}
