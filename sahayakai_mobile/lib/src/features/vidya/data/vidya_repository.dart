import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/vidya_models.dart';

final vidyaRepositoryProvider = Provider((ref) {
  return VidyaRepository(ref.read(apiClientProvider));
});

class VidyaRepository {
  final ApiClient _apiClient;

  VidyaRepository(this._apiClient);

  /// Send a message to VIDYA and get a response with optional action.
  ///
  /// POST /assistant — public endpoint but benefits from auth for personalization.
  Future<VidyaResponse> chat({
    required String message,
    List<Map<String, String>>? chatHistory,
    Map<String, dynamic>? currentScreenContext,
    Map<String, dynamic>? teacherProfile,
    String? detectedLanguage,
  }) async {
    final response = await _apiClient.client.post(
      '/assistant',
      data: {
        'message': message,
        if (chatHistory != null) 'chatHistory': chatHistory,
        if (currentScreenContext != null)
          'currentScreenContext': currentScreenContext,
        if (teacherProfile != null) 'teacherProfile': teacherProfile,
        if (detectedLanguage != null) 'detectedLanguage': detectedLanguage,
      },
    );

    if (response.statusCode == 200) {
      return VidyaResponse.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('VIDYA chat failed: ${response.statusCode}');
  }

  /// Fetch the most recent conversation session.
  Future<VidyaSession?> getSession() async {
    try {
      final response = await _apiClient.client.get('/vidya/session');
      if (response.statusCode == 200 && response.data != null) {
        return VidyaSession.fromJson(response.data as Map<String, dynamic>);
      }
    } catch (_) {
      // No session or network error — return null.
    }
    return null;
  }

  /// Save the current session.
  Future<void> saveSession(VidyaSession session) async {
    await _apiClient.client.post(
      '/vidya/session',
      data: session.toJson(),
    );
  }

  /// Get VIDYA's persistent memory about this teacher.
  Future<VidyaProfile?> getProfile() async {
    try {
      final response = await _apiClient.client.get('/vidya/profile');
      if (response.statusCode == 200 && response.data != null) {
        return VidyaProfile.fromJson(response.data as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }

  /// Update VIDYA's persistent memory.
  Future<void> updateProfile(VidyaProfile profile) async {
    await _apiClient.client.post(
      '/vidya/profile',
      data: profile.toJson(),
    );
  }
}
