import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

final visualAidRepositoryProvider = Provider((ref) {
  return VisualAidRepository(ref.read(apiClientProvider));
});

/// Response model for POST /ai/visual-aid.
class VisualAidOutput {
  final String? imageDataUri; // Base64 image data URI
  final String pedagogicalContext;
  final String discussionSpark;
  final String? subject;
  final String? storagePath;

  const VisualAidOutput({
    this.imageDataUri,
    required this.pedagogicalContext,
    required this.discussionSpark,
    this.subject,
    this.storagePath,
  });

  factory VisualAidOutput.fromJson(Map<String, dynamic> json) {
    return VisualAidOutput(
      imageDataUri: json['imageDataUri'] as String?,
      pedagogicalContext: json['pedagogicalContext'] as String? ?? '',
      discussionSpark: json['discussionSpark'] as String? ?? '',
      subject: json['subject'] as String?,
      storagePath: json['storagePath'] as String?,
    );
  }
}

class VisualAidRepository {
  final ApiClient _apiClient;

  VisualAidRepository(this._apiClient);

  /// Generate a visual aid image via Gemini 2.5 Flash Image.
  ///
  /// May take up to 2 minutes. Backend returns 429 if daily limit reached.
  Future<VisualAidOutput> generate({
    required String prompt,
    String? gradeLevel,
    String? language,
    String? subject,
  }) async {
    final response = await _apiClient.client.post(
      '/ai/visual-aid',
      data: {
        'prompt': prompt,
        if (gradeLevel != null) 'gradeLevel': gradeLevel,
        if (language != null) 'language': language,
        if (subject != null) 'subject': subject,
      },
      options: Options(
        receiveTimeout: const Duration(seconds: 120), // Image gen is slow
      ),
    );

    return VisualAidOutput.fromJson(response.data as Map<String, dynamic>);
  }
}
