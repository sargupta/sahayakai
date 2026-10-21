import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/quiz_repository.dart';
import '../domain/quiz.dart';

part 'quiz_controller.g.dart';

/// Drives the quiz screen through `AsyncValue<Quiz?>`:
///   - `AsyncData(null)`  -> empty / idle (initial),
///   - `AsyncLoading`     -> long-running skeleton (server maxDuration 120 s),
///   - `AsyncError`       -> typed `ApiException` the view maps to the right UI,
///   - `AsyncData(quiz)`  -> the rendered difficulty variants.
@riverpod
class QuizController extends _$QuizController {
  @override
  FutureOr<Quiz?> build() => null;

  Future<void> generate(QuizRequest request) async {
    state = const AsyncValue<Quiz?>.loading();
    state = await AsyncValue.guard<Quiz?>(
      () => ref.read(quizRepositoryProvider).generate(request),
    );
  }

  /// Return to the empty/idle state (e.g. after a successful save).
  void clear() => state = const AsyncValue<Quiz?>.data(null);
}
