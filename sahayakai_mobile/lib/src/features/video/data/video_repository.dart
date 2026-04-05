import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

final videoRepositoryProvider = Provider((ref) {
  return VideoRepository(ref.read(apiClientProvider));
});

/// Response model for POST /ai/video-storyteller.
/// Returns YouTube video search queries organized by category.
class VideoOutput {
  final Map<String, List<String>> categories;
  final String personalizedMessage;

  const VideoOutput({
    required this.categories,
    required this.personalizedMessage,
  });

  factory VideoOutput.fromJson(Map<String, dynamic> json) {
    final categoriesRaw = json['categories'] as Map<String, dynamic>? ?? {};
    final categories = categoriesRaw.map(
      (key, value) => MapEntry(key, List<String>.from(value ?? [])),
    );

    return VideoOutput(
      categories: categories,
      personalizedMessage: json['personalizedMessage'] as String? ?? '',
    );
  }
}

class VideoRepository {
  final ApiClient _apiClient;

  VideoRepository(this._apiClient);

  /// Get curated video recommendations for a topic.
  /// This endpoint is NOT plan-gated — free for all users.
  Future<VideoOutput> getRecommendations({
    String? subject,
    String? gradeLevel,
    String? topic,
    String? language,
    String? state,
    String? educationBoard,
  }) async {
    final response = await _apiClient.client.post(
      '/ai/video-storyteller',
      data: {
        if (subject != null) 'subject': subject,
        if (gradeLevel != null) 'gradeLevel': gradeLevel,
        if (topic != null) 'topic': topic,
        if (language != null) 'language': language,
        if (state != null) 'state': state,
        if (educationBoard != null) 'educationBoard': educationBoard,
      },
    );

    if (response.statusCode == 200) {
      return VideoOutput.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('Video recommendations failed: ${response.statusCode}');
  }
}
