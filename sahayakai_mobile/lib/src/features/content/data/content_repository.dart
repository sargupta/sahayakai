import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/network/api_client.dart';
import '../domain/content_models.dart';

final contentRepositoryProvider = Provider((ref) {
  return ContentRepository(ref.read(apiClientProvider));
});

class ContentRepository {
  final ApiClient _apiClient;

  ContentRepository(this._apiClient);

  /// Save generated content to the user's library.
  ///
  /// Returns the content ID on success.
  Future<String> saveContent({
    required String type,
    required String title,
    required Map<String, dynamic> data,
    String? gradeLevel,
    String? subject,
    String? topic,
    String? language,
    bool isPublic = false,
  }) async {
    final id = const Uuid().v4();
    final response = await _apiClient.client.post(
      '/content/save',
      data: {
        'id': id,
        'type': type,
        'title': title,
        'data': data,
        if (gradeLevel != null) 'gradeLevel': gradeLevel,
        if (subject != null) 'subject': subject,
        if (topic != null) 'topic': topic,
        if (language != null) 'language': language,
        'isPublic': isPublic,
      },
    );

    if (response.statusCode == 200) {
      return response.data['id'] as String? ?? id;
    }
    throw Exception('Failed to save content: ${response.statusCode}');
  }

  /// List the user's saved content with optional filters and pagination.
  Future<ContentListResponse> listContent({
    String? type,
    int limit = 10,
    String? cursor,
    List<String>? gradeLevels,
    List<String>? subjects,
  }) async {
    final response = await _apiClient.client.get(
      '/content/list',
      queryParameters: {
        if (type != null) 'type': type,
        'limit': limit,
        if (cursor != null) 'cursor': cursor,
        if (gradeLevels != null && gradeLevels.isNotEmpty)
          'gradeLevels': gradeLevels.join(','),
        if (subjects != null && subjects.isNotEmpty)
          'subjects': subjects.join(','),
      },
    );

    if (response.statusCode == 200) {
      return ContentListResponse.fromJson(
          response.data as Map<String, dynamic>);
    }
    throw Exception('Failed to list content: ${response.statusCode}');
  }

  /// Get a single content item by ID.
  Future<ContentItem> getContent(String contentId) async {
    final response = await _apiClient.client.get(
      '/content/get',
      queryParameters: {'id': contentId},
    );

    if (response.statusCode == 200) {
      return ContentItem.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('Failed to get content: ${response.statusCode}');
  }

  /// Soft-delete a content item.
  Future<void> deleteContent(String contentId) async {
    final response = await _apiClient.client.delete(
      '/content/delete',
      queryParameters: {'id': contentId},
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to delete content: ${response.statusCode}');
    }
  }

  /// Publish an already-saved content item to the community library.
  Future<void> publishToLibrary(String contentId) async {
    final response = await _apiClient.client.post(
      '/content/publish',
      data: {'id': contentId},
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to publish content: ${response.statusCode}');
    }
  }

  /// Get a signed download URL for a content item (valid 15 minutes).
  Future<String> getDownloadUrl(String contentId) async {
    final response = await _apiClient.client.get(
      '/content/download',
      queryParameters: {'id': contentId},
    );

    if (response.statusCode == 200) {
      return response.data['downloadUrl'] as String;
    }
    throw Exception('Failed to get download URL: ${response.statusCode}');
  }
}
