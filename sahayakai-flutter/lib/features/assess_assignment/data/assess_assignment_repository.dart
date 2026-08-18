import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../../../shared/data/content_id.dart';
import '../domain/assessment.dart';
import 'assess_assignment_dtos.dart';

part 'assess_assignment_repository.g.dart';

/// Data-layer gateway for the Assess Assignment tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// already maps from Dio (incl. the day-budget mapping documented in
/// docs/flutter/HANDOFF.md).
class AssessAssignmentRepository {
  const AssessAssignmentRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/assess-assignment';
  static const String _savePath = '/api/content/save';

  Future<Assessment> assess(AssessAssignmentRequest request) {
    return _client.post<Assessment>(
      _path,
      data: AssessAssignmentRequestDto.fromDomain(request).toJson(),
      // Carry the verbatim body onto the domain so a later Save persists the
      // exact `data: finalOutput` the backend flow does.
      decode: (json) =>
          AssessAssignmentResponseDto.fromJson(json).toDomain(raw: json),
    );
  }

  /// Save a scored assignment to the teacher's library via
  /// `POST /api/content/save`. The body mirrors the `dbAdapter.saveContent`
  /// call in `sahayakai-main/src/ai/flows/assignment-assessor.ts`
  /// field-for-field (`type: 'assessment'`, title
  /// `Assessment: {subject} ({overallScore}%)`, grade/subject off the rubric
  /// snapshot with the flow's own defaults, topic `rubricSnapshot.title ||
  /// 'Handwritten assignment'`), so the Library reads it back through
  /// `mapSavedAssessment` unchanged. Returns the new content id the endpoint
  /// echoes as `id`. Throws `ApiException` on failure.
  ///
  /// The request carries no grade or subject of its own — the rubric the
  /// teacher attached is the only source for either, which is why they are read
  /// off [Assessment.rubric] here rather than off the request.
  Future<String> save({
    required Assessment assessment,
    required AssessAssignmentRequest request,
  }) {
    final rubric = assessment.rubric;
    final subject = rubric?.subject?.trim();
    final rubricTitle = rubric?.title.trim();
    final language = (request.language ?? assessment.language ?? '').trim();
    final score = assessment.overallScore;
    final scoreSuffix = score == null ? '' : ' (${_formatScore(score)}%)';
    final body = <String, dynamic>{
      'id': newContentId(),
      'type': 'assessment',
      'title':
          'Assessment: ${subject == null || subject.isEmpty ? 'Assignment' : subject}$scoreSuffix',
      'gradeLevel': rubric?.gradeLevel ?? 'Class 5',
      'subject': (subject == null || subject.isEmpty) ? 'General' : subject,
      'topic': (rubricTitle == null || rubricTitle.isEmpty)
          ? 'Handwritten assignment'
          : rubricTitle,
      'language': language.isEmpty ? 'English' : language,
      'isPublic': false,
      'isDraft': false,
      // The full model output — exactly what the flow persists as `data`.
      'data': assessment.raw,
    };
    return _client.post<String>(
      _savePath,
      data: body,
      decode: (json) => (json['id'] as String?)?.trim() ?? '',
    );
  }
}

/// Drops a trailing `.0` so `82.0` reads as `82` in the saved title.
String _formatScore(num value) => value == value.roundToDouble()
    ? value.toInt().toString()
    : value.toString();

@riverpod
AssessAssignmentRepository assessAssignmentRepository(Ref ref) {
  return AssessAssignmentRepository(ref.watch(apiClientProvider));
}
