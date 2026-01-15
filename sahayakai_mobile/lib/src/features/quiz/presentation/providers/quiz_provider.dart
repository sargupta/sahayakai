import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/quiz_repository.dart';
import '../../domain/quiz_models.dart';

final quizResultProvider = StateProvider<Quiz?>((ref) => null);
final quizLoadingProvider = StateProvider<bool>((ref) => false);
final quizErrorProvider = StateProvider<String?>((ref) => null);

class QuizNotifier {
  final Ref ref;

  QuizNotifier(this.ref);

  Future<void> createQuiz(QuizConfig config) async {
    ref.read(quizLoadingProvider.notifier).state = true;
    ref.read(quizErrorProvider.notifier).state = null;
    ref.read(quizResultProvider.notifier).state = null;

    try {
      final quiz = await ref.read(quizRepositoryProvider).generateQuiz(config);
      ref.read(quizResultProvider.notifier).state = quiz;
    } catch (e) {
      ref.read(quizErrorProvider.notifier).state = e.toString();
    } finally {
      ref.read(quizLoadingProvider.notifier).state = false;
    }
  }
}

final quizControllerProvider = Provider((ref) => QuizNotifier(ref));
