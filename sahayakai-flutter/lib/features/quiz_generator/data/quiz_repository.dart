import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
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

  Future<Quiz> generate(QuizRequest request) {
    return _client.post<Quiz>(
      _path,
      data: QuizRequestDto.fromDomain(request).toJson(),
      decode: (json) => QuizResponseDto.fromJson(json).toDomain(),
    );
  }
}

@riverpod
QuizRepository quizRepository(Ref ref) {
  return QuizRepository(ref.watch(apiClientProvider));
}
