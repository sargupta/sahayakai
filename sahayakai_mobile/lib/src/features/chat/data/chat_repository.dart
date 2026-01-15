import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

final chatRepositoryProvider = Provider((ref) => ChatRepository(ref.read(apiClientProvider)));

class ChatRepository {
  final ApiClient _apiClient;

  ChatRepository(this._apiClient);

  Future<Map<String, dynamic>> sendQuestion(String question, String language, String grade) async {
    final response = await _apiClient.client.post('/chat', data: {
      'question': question,
      'language': language,
      'gradeLevel': grade,
    });
    return response.data;
  }
}
