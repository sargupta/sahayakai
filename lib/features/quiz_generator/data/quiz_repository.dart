import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../../../shared/data/content_id.dart';
import '../domain/quiz.dart';
import 'quiz_dtos.dart';

part 'quiz_repository.g.dart';

/// Data-layer gateway for the quiz tool. Presentation talks to the controller,
/// the controller to this repository, and only this repository touches
/// [ApiClient]. Errors surface as the typed `ApiException` the client already
/// maps from Dio.
class QuizRepository {
  const QuizRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/quiz';
  static const String _savePath = '/api/content/save';

  Future<Quiz> generate(QuizRequest request) {
    return _client.post<Quiz>(
      _path,
      data: QuizRequestDto.fromDomain(request).toJson(),
      // Carry the verbatim body onto the domain so a later Save persists the
      // exact `data: output` the backend flow does.
      decode: (json) => QuizResponseDto.fromJson(json).toDomain(raw: json),
    );
  }

  /// Save a generated quiz to the teacher's library via
  /// `POST /api/content/save`. The body mirrors the `dbAdapter.saveContent`
  /// call in `sahayakai-main/src/ai/flows/quiz-generator.ts` field-for-field
  /// (`type: 'quiz'`, title `input.topic || 'Quiz'`, `gradeLevel:
  /// output.gradeLevel || input.gradeLevel || 'Class 5'`, `subject:
  /// output.subject || 'General'`, `data:` the multi-variant envelope), so
  /// the Library reads it back through `mapSavedQuiz` unchanged. Returns the
  /// new content id the endpoint echoes as `id`. Throws `ApiException` on
  /// failure.
  Future<String> save({required Quiz quiz, required QuizRequest request}) {
    final topic = request.topic.trim();
    final language = request.language?.trim() ?? '';
    final body = <String, dynamic>{
      'id': newContentId(),
      'type': 'quiz',
      'title': topic.isEmpty ? 'Quiz' : topic,
      'gradeLevel': quiz.gradeLevel ?? request.gradeLevel ?? 'Class 5',
      'subject': quiz.subject ?? request.subject ?? 'General',
      'topic': topic.isEmpty ? (quiz.topic ?? 'Quiz') : topic,
      'language': language.isEmpty ? 'English' : language,
      'isPublic': false,
      'isDraft': false,
      // The full model output — exactly what the flow persists as `data`.
      'data': quiz.raw,
    };
    return _client.post<String>(
      _savePath,
      data: body,
      decode: (json) => (json['id'] as String?)?.trim() ?? '',
    );
  }
}

@riverpod
QuizRepository quizRepository(Ref ref) {
  return QuizRepository(ref.watch(apiClientProvider));
}
