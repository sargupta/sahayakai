import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final feedbackRepositoryProvider = Provider((ref) {
  return FeedbackRepository(ref.read(apiClientProvider));
});

class FeedbackRepository {
  final ApiClient _apiClient;

  FeedbackRepository(this._apiClient);

  /// POST /feedback — submit content feedback.
  Future<void> submit({
    required String contentId,
    required int rating,
    String? difficulty,
    int? questionIndex,
    String? comment,
  }) async {
    final response = await _apiClient.client.post(
      '/feedback',
      data: {
        'contentId': contentId,
        'rating': rating,
        if (difficulty != null) 'difficulty': difficulty,
        if (questionIndex != null) 'questionIndex': questionIndex,
        if (comment != null) 'comment': comment,
      },
    );
    if (response.statusCode != 200) {
      throw Exception('Feedback submission failed: ${response.statusCode}');
    }
  }

  /// POST /feedback/app — submit general app feedback (bug report, feature request, etc.).
  Future<void> submitAppFeedback({
    required String title,
    required String description,
    required String category, // 'bug', 'feature', 'general'
  }) async {
    final response = await _apiClient.client.post(
      '/feedback/app',
      data: {
        'title': title,
        'description': description,
        'category': category,
      },
    );
    if (response.statusCode != 200) {
      throw Exception('Feedback submission failed: ${response.statusCode}');
    }
  }
}
