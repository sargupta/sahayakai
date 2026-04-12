import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../domain/instant_answer_models.dart';

final instantAnswerRepositoryProvider = Provider((ref) {
  return InstantAnswerRepository(ref.read(apiClientProvider));
});

class InstantAnswerRepository {
  final ApiClient _apiClient;

  InstantAnswerRepository(this._apiClient);

  Future<InstantAnswerOutput> getAnswer(InstantAnswerInput input) async {
    try {
      final response = await _apiClient.client.post(
        '/ai/instant-answer',
        data: input.toJson(),
      );
      return InstantAnswerOutput.fromJson(response.data);
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 403) {
        throw const InstantAnswerException(
          'You have reached your monthly limit. Upgrade your plan to continue.',
          isPlanLimit: true,
        );
      }
      if (status == 429) {
        throw const InstantAnswerException(
          'Monthly usage limit reached. Please try again next month.',
          isPlanLimit: true,
        );
      }
      throw InstantAnswerException(
          e.response?.data?['error'] as String? ??
              e.message ??
              'Failed to get answer.');
    }
  }
}
