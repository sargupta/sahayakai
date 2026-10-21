import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/exam_paper_repository.dart';
import '../domain/exam_paper.dart';

part 'exam_paper_controller.g.dart';

/// Drives the exam-paper screen through `AsyncValue<ExamPaperResult?>`:
///   - `AsyncData(null)`                 -> empty / idle (initial),
///   - `AsyncLoading`                    -> long-running skeleton (maxDuration 120 s),
///   - `AsyncError`                      -> typed `ApiException` the view maps
///                                          (incl. 422 -> fewer-chapters guidance),
///   - `AsyncData(ExamPaperReady)`       -> the rendered paper (its footer's
///                                          shared `ResultActionsBar` owns the
///                                          save action and its own state),
///   - `AsyncData(ExamPaperInProgress)`  -> the 202 "we'll save it to your
///                                          Library" state (NOT an error).
@riverpod
class ExamPaperController extends _$ExamPaperController {
  @override
  FutureOr<ExamPaperResult?> build() => null;

  Future<void> generate(ExamPaperRequest request) async {
    state = const AsyncValue<ExamPaperResult?>.loading();
    state = await AsyncValue.guard<ExamPaperResult?>(
      () => ref.read(examPaperRepositoryProvider).generate(request),
    );
  }

  /// Return to the empty/idle state.
  void clear() => state = const AsyncValue<ExamPaperResult?>.data(null);
}
