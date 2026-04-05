import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../domain/quiz_models.dart';

final quizRepositoryProvider = Provider((ref) => QuizRepository(ref.read(apiClientProvider)));

class QuizRepository {
  final ApiClient _apiClient;

  QuizRepository(this._apiClient);

  Future<Quiz> generateQuiz(QuizConfig config) async {
    final response = await _apiClient.client.post(
      '/quiz',
      data: config.toJson(),
    );

    return Quiz.fromJson(response.data);
  }
}
