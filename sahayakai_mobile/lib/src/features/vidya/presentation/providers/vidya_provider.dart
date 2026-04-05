import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/vidya_repository.dart';
import '../../domain/vidya_models.dart';

/// State for the VIDYA chat screen.
class VidyaChatState {
  final List<VidyaTurn> turns;
  final bool isLoading;
  final String? error;

  const VidyaChatState({
    this.turns = const [],
    this.isLoading = false,
    this.error,
  });

  VidyaChatState copyWith({
    List<VidyaTurn>? turns,
    bool? isLoading,
    String? error,
  }) =>
      VidyaChatState(
        turns: turns ?? this.turns,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );

  /// Chat history formatted for the backend.
  List<Map<String, String>> get chatHistory =>
      turns.map((t) => {'user': t.user, 'ai': t.ai}).toList();
}

class VidyaChatNotifier extends StateNotifier<VidyaChatState> {
  final VidyaRepository _repo;

  VidyaChatNotifier(this._repo) : super(const VidyaChatState());

  /// Send a message to VIDYA.
  Future<void> sendMessage(
    String text, {
    Map<String, dynamic>? screenContext,
    Map<String, dynamic>? teacherProfile,
    String? language,
  }) async {
    if (text.trim().isEmpty) return;

    state = state.copyWith(isLoading: true, error: null);

    try {
      final response = await _repo.chat(
        message: text,
        chatHistory: state.chatHistory,
        currentScreenContext: screenContext,
        teacherProfile: teacherProfile,
        detectedLanguage: language,
      );

      final turn = VidyaTurn(
        user: text,
        ai: response.response,
        action: response.action,
        timestamp: DateTime.now(),
      );

      state = state.copyWith(
        turns: [...state.turns, turn],
        isLoading: false,
      );

      // Fire-and-forget: save session to backend.
      _saveSessionQuietly();
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'VIDYA is having trouble. Please try again.',
      );
    }
  }

  /// Clear conversation history.
  void clearHistory() {
    state = const VidyaChatState();
  }

  /// Restore session from backend on first open.
  Future<void> restoreSession() async {
    try {
      final session = await _repo.getSession();
      if (session != null && session.turns.isNotEmpty) {
        state = state.copyWith(turns: session.turns);
      }
    } catch (_) {
      // Silently ignore — start fresh.
    }
  }

  void _saveSessionQuietly() {
    try {
      final session = VidyaSession(
        turns: state.turns,
        createdAt: state.turns.first.timestamp,
        updatedAt: DateTime.now(),
      );
      _repo.saveSession(session);
    } catch (_) {}
  }
}

final vidyaChatProvider =
    StateNotifierProvider<VidyaChatNotifier, VidyaChatState>((ref) {
  return VidyaChatNotifier(ref.read(vidyaRepositoryProvider));
});

/// VIDYA's persistent profile memory.
final vidyaProfileProvider =
    FutureProvider.autoDispose<VidyaProfile?>((ref) async {
  return ref.read(vidyaRepositoryProvider).getProfile();
});
