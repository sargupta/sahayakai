import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../../../shared/data/content_id.dart';
import '../domain/instant_answer.dart';
import 'instant_answer_dtos.dart';

part 'instant_answer_repository.g.dart';

/// Data-layer gateway for the Instant Answer tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// already maps from Dio.
class InstantAnswerRepository {
  const InstantAnswerRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/instant-answer';
  static const String _savePath = '/api/content/save';

  Future<InstantAnswer> ask(InstantAnswerRequest request) {
    return _client.post<InstantAnswer>(
      _path,
      data: InstantAnswerRequestDto.fromDomain(request).toJson(),
      // Carry the verbatim body onto the domain so a later Save persists the
      // exact `data: sanitizedOutput` the backend flow does.
      decode: (json) =>
          InstantAnswerResponseDto.fromJson(json).toDomain(raw: json),
    );
  }

  /// Save an answer to the teacher's library via `POST /api/content/save`. The
  /// body mirrors the `dbAdapter.saveContent` call in
  /// `sahayakai-main/src/ai/flows/instant-answer.ts` field-for-field
  /// (`type: 'instant-answer'`, both `title` and `topic` are the teacher's own
  /// question, `gradeLevel: output.gradeLevel || input.gradeLevel ||
  /// 'Class 5'`, `subject: input.subject || output.subject || 'General'`,
  /// `data: <the sanitized model output>`), so the Library reads it back
  /// through `mapSavedInstantAnswer` — and re-titles the item with the
  /// question — unchanged. Returns the new content id the endpoint echoes as
  /// `id`. Throws `ApiException` on failure.
  Future<String> save({
    required InstantAnswer answer,
    required InstantAnswerRequest request,
  }) {
    final question = request.question.trim();
    final language = request.language?.trim() ?? '';
    final body = <String, dynamic>{
      'id': newContentId(),
      'type': 'instant-answer',
      'title': question.isEmpty ? 'Instant Answer' : question,
      'gradeLevel': answer.gradeLevel ?? request.gradeLevel ?? 'Class 5',
      'subject': request.subject ?? answer.subject ?? 'General',
      'topic': question.isEmpty ? 'Instant Answer' : question,
      'language': language.isEmpty ? 'English' : language,
      'isPublic': false,
      'isDraft': false,
      // The full model output — exactly what the flow persists as `data`.
      'data': answer.raw,
    };
    return _client.post<String>(
      _savePath,
      data: body,
      decode: (json) => (json['id'] as String?)?.trim() ?? '',
    );
  }
}

@riverpod
InstantAnswerRepository instantAnswerRepository(Ref ref) {
  return InstantAnswerRepository(ref.watch(apiClientProvider));
}
