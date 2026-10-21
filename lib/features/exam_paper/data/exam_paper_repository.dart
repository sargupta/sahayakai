import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/exam_paper.dart';
import 'exam_paper_dtos.dart';

part 'exam_paper_repository.g.dart';

/// Data-layer gateway for the exam-paper tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// already maps from Dio (401 / 403 / 429 / 422 / 400 / 503 …); the **202
/// generation_in_progress** case is NOT an error — it is a distinct
/// [ExamPaperInProgress] result decoded off the (success-status) body.
class ExamPaperRepository {
  const ExamPaperRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/exam-paper';

  /// Generate a paper. Returns [ExamPaperReady] (200) or [ExamPaperInProgress]
  /// (202). Throws `ApiException` for 4xx/5xx (the 422 `exam_paper_unstructured`
  /// carries `statusCode == 422` and `errorCode == 'exam_paper_unstructured'`
  /// so the screen can show the "try fewer chapters" guidance distinctly).
  Future<ExamPaperResult> generate(ExamPaperRequest request) {
    return _client.post<ExamPaperResult>(
      _path,
      data: ExamPaperRequestDto.fromDomain(request).toJson(),
      decode: ExamPaperResponseDto.resultFrom,
    );
  }

  /// Save a generated paper to the teacher's library via
  /// `PUT /api/ai/exam-paper` with `{ "paper": <verbatim server JSON> }`.
  /// Returns the new `contentId`. Sending the raw response JSON (not a
  /// re-serialized domain object) keeps the saved paper byte-identical to what
  /// the model produced. Throws `ApiException` on failure.
  Future<String> save(ExamPaperReady ready) {
    return _client.put<String>(
      _path,
      data: <String, dynamic>{'paper': ready.raw},
      decode: (json) => (json['contentId'] as String?)?.trim() ?? '',
    );
  }
}

@riverpod
ExamPaperRepository examPaperRepository(Ref ref) {
  return ExamPaperRepository(ref.watch(apiClientProvider));
}
