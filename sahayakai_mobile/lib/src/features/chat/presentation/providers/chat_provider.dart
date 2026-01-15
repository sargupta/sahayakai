import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../data/chat_repository.dart';
import '../../domain/chat_message.dart';

final chatMessagesProvider = StateNotifierProvider<ChatNotifier, List<ChatMessage>>((ref) {
  return ChatNotifier(ref.read(chatRepositoryProvider));
});

final chatLoadingProvider = StateProvider<bool>((ref) => false);

class ChatNotifier extends StateNotifier<List<ChatMessage>> {
  final ChatRepository _repo;
  final _uuid = const Uuid();

  ChatNotifier(this._repo) : super([]);

  Future<void> askQuestion(String question) async {
    final userMsg = ChatMessage(
      id: _uuid.v4(),
      text: question,
      isUser: true,
      timestamp: DateTime.now(),
    );
    state = [...state, userMsg];

    try {
      final response = await _repo.sendQuestion(question, 'English', 'Grade 6');
      
      final aiMsg = ChatMessage(
        id: _uuid.v4(),
        text: response['answer'] ?? "No answer received.",
        isUser: false,
        timestamp: DateTime.now(),
        videoUrl: response['videoSuggestionUrl'],
      );
      state = [...state, aiMsg];
    } catch (e) {
      final errorMsg = ChatMessage(
        id: _uuid.v4(),
        text: "Error: ${e.toString()}",
        isUser: false,
        timestamp: DateTime.now(),
      );
      state = [...state, errorMsg];
    }
  }
}
