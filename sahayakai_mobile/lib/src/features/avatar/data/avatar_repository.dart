import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final avatarRepositoryProvider = Provider((ref) {
  return AvatarRepository(ref.read(apiClientProvider));
});

class AvatarRepository {
  final ApiClient _apiClient;

  AvatarRepository(this._apiClient);

  /// Generate AI avatar. Returns base64 PNG string.
  Future<String> generateAvatar({
    required String style,
    String? topic,
    String? language,
  }) async {
    final response = await _apiClient.client.post(
      '/ai/avatar',
      data: {
        'style': style,
        if (topic != null) 'topic': topic,
        if (language != null) 'language': language,
      },
    );

    if (response.statusCode == 200) {
      return response.data['imageBase64'] as String;
    }

    throw Exception('Avatar generation failed: ${response.statusCode}');
  }

  /// Get daily quota info.
  Future<({int used, int limit})> getQuota() async {
    final response = await _apiClient.client.get('/ai/avatar/quota');
    final data = response.data as Map<String, dynamic>;
    return (used: data['used'] as int, limit: data['limit'] as int);
  }
}
