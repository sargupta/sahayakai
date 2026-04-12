import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final parentMessageRepositoryProvider = Provider((ref) {
  return ParentMessageRepository(ref.read(apiClientProvider));
});

class ParentMessageOutput {
  final String message;
  final String? tone;
  final String? subject;

  const ParentMessageOutput({
    required this.message,
    this.tone,
    this.subject,
  });

  factory ParentMessageOutput.fromJson(Map<String, dynamic> json) =>
      ParentMessageOutput(
        message: json['message'] as String? ?? '',
        tone: json['tone'] as String?,
        subject: json['subject'] as String?,
      );
}

class ParentMessageRepository {
  final ApiClient _apiClient;

  ParentMessageRepository(this._apiClient);

  Future<ParentMessageOutput> generate({
    required String context,
    String? studentName,
    String? language,
  }) async {
    final response = await _apiClient.client.post(
      '/ai/parent-message',
      data: {
        'context': context,
        if (studentName != null) 'studentName': studentName,
        if (language != null) 'language': language,
      },
    );

    if (response.statusCode == 200) {
      return ParentMessageOutput.fromJson(
          response.data as Map<String, dynamic>);
    }
    throw Exception('Parent message failed: ${response.statusCode}');
  }
}
