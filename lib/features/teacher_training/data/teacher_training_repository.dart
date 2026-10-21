import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../../../shared/data/content_id.dart';
import '../domain/teacher_advice.dart';
import 'teacher_training_dtos.dart';

part 'teacher_training_repository.g.dart';

/// Data-layer gateway for the Teaching Coach tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// already maps from Dio.
class TeacherTrainingRepository {
  const TeacherTrainingRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/teacher-training';
  static const String _savePath = '/api/content/save';

  Future<TeacherAdvice> advise(TeacherTrainingRequest request) {
    return _client.post<TeacherAdvice>(
      _path,
      data: TeacherTrainingRequestDto.fromDomain(request).toJson(),
      // Carry the verbatim body onto the domain so a later Save persists the
      // exact `data: output` the backend flow does.
      decode: (json) =>
          TeacherTrainingResponseDto.fromJson(json).toDomain(raw: json),
    );
  }

  /// Save generated advice to the teacher's library via
  /// `POST /api/content/save`. The body mirrors the `dbAdapter.saveContent`
  /// call in `sahayakai-main/src/ai/flows/teacher-training.ts` field-for-field
  /// (`type: 'teacher-training'`, title `Advice: {first 50 chars of the
  /// question}...`, `gradeLevel: output.gradeLevel || 'Class 5'`, `subject:
  /// input.subject || output.subject || 'General'`, topic `input.question`,
  /// `data: <the model output>`), so the Library reads it back through
  /// `mapSavedTeacherAdvice` unchanged. Returns the new content id the endpoint
  /// echoes as `id`. Throws `ApiException` on failure.
  Future<String> save({
    required TeacherAdvice advice,
    required TeacherTrainingRequest request,
  }) {
    final question = request.question.trim();
    final language = request.language?.trim() ?? '';
    // The flow always appends the ellipsis, even for a short question — mirror
    // it exactly so a mobile save and a server-side save read identically in
    // the Library list.
    final seed = question.length <= 50 ? question : question.substring(0, 50);
    final body = <String, dynamic>{
      'id': newContentId(),
      'type': 'teacher-training',
      'title': 'Advice: $seed...',
      'gradeLevel': advice.gradeLevel ?? 'Class 5',
      'subject': request.subject ?? advice.subject ?? 'General',
      'topic': question,
      'language': language.isEmpty ? 'English' : language,
      'isPublic': false,
      'isDraft': false,
      // The full model output — exactly what the flow persists as `data`.
      'data': advice.raw,
    };
    return _client.post<String>(
      _savePath,
      data: body,
      decode: (json) => (json['id'] as String?)?.trim() ?? '',
    );
  }
}

@riverpod
TeacherTrainingRepository teacherTrainingRepository(Ref ref) {
  return TeacherTrainingRepository(ref.watch(apiClientProvider));
}
