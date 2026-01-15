import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

final toolRepositoryProvider = Provider((ref) {
  return ToolRepository(ref.read(apiClientProvider));
});

class ToolRepository {
  final ApiClient _apiClient;

  ToolRepository(this._apiClient);

  /// Generates content by sending a structured prompt to the generic Chat API.
  /// This bridges the gap for tools that don't have dedicated endpoints yet.
  Future<String> generateToolContent({
    required String toolName,
    required String prompt,
    required String language,
    String? gradeLevel,
    String? subject,
  }) async {
    try {
      // Construct a System Prompt for the AI
      final systemInstruction =
          "You are an expert educational AI assistant for teachers in India. "
          "Your task is to generate content for the tool: '$toolName'. "
          "Output must be in '$language'. "
          "Target Audience: ${gradeLevel ?? 'General'} students."
          "Format the output in clean Markdown.";

      final userMessage = "Subject: ${subject ?? 'General'}\nRequest: $prompt";

      // Call the Chat API
      final response = await _apiClient.client.post(
        '/chat', // Using the existing generic chat endpoint
        data: {
          'message':
              "$systemInstruction\n\n$userMessage", // Sending as single prompt for now if API expects 'message'
          'history': [], // Stateless for tools
          // If the API supports 'systemPrompt' separately, we could send it, but /chat likely takes a user message.
        },
      );

      if (response.statusCode == 200) {
        // The API returns { answer: "..." } based on InstantAnswer implementation
        return response.data['answer'] ?? "No response generated.";
      } else {
        throw Exception("Failed to generate content: ${response.statusCode}");
      }
    } catch (e) {
      throw Exception("Error generating content: $e");
    }
  }
}
