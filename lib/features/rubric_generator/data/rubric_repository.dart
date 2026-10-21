import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../../../shared/data/content_id.dart';
import '../domain/rubric.dart';
import 'rubric_dtos.dart';

part 'rubric_repository.g.dart';

/// Data-layer gateway for the rubric tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// already maps from Dio.
class RubricRepository {
  const RubricRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/rubric';
  static const String _savePath = '/api/content/save';

  Future<Rubric> generate(RubricRequest request) {
    return _client.post<Rubric>(
      _path,
      data: RubricRequestDto.fromDomain(request).toJson(),
      // Carry the verbatim body onto the domain so a later Save persists the
      // exact `data: output` the backend flow does.
      decode: (json) => RubricResponseDto.fromJson(json).toDomain(raw: json),
    );
  }

  /// Save a generated rubric to the teacher's library via
  /// `POST /api/content/save`. The body mirrors the `dbAdapter.saveContent`
  /// call in `sahayakai-main/src/ai/flows/rubric-generator.ts` field-for-field
  /// (`type: 'rubric'`, title `output.title` falling back to
  /// `Rubric: {assignmentDescription}`, `gradeLevel: output.gradeLevel ||
  /// input.gradeLevel || 'Class 5'`, `subject: input.subject ||
  /// output.subject || 'General'`, topic `input.assignmentDescription`,
  /// `data: <the model output>`), so the Library reads it back through
  /// `mapSavedRubric` unchanged. Returns the new content id the endpoint echoes
  /// as `id`. Throws `ApiException` on failure.
  Future<String> save({
    required Rubric rubric,
    required RubricRequest request,
  }) {
    final assignment = request.assignmentDescription.trim();
    final language = request.language?.trim() ?? '';
    final body = <String, dynamic>{
      'id': newContentId(),
      'type': 'rubric',
      'title': rubric.title.isNotEmpty
          ? rubric.title
          : 'Rubric: ${assignment.isEmpty ? 'Untitled' : assignment}',
      'gradeLevel': rubric.gradeLevel ?? request.gradeLevel ?? 'Class 5',
      'subject': request.subject ?? rubric.subject ?? 'General',
      'topic': assignment.isEmpty ? rubric.title : assignment,
      'language': language.isEmpty ? 'English' : language,
      'isPublic': false,
      'isDraft': false,
      // The full model output — exactly what the flow persists as `data`.
      'data': rubric.raw,
    };
    return _client.post<String>(
      _savePath,
      data: body,
      decode: (json) => (json['id'] as String?)?.trim() ?? '',
    );
  }
}

@riverpod
RubricRepository rubricRepository(Ref ref) {
  return RubricRepository(ref.watch(apiClientProvider));
}
