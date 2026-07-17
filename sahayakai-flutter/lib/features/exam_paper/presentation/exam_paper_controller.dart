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
///   - `AsyncData(ExamPaperReady)`       -> the rendered paper + save action,
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

/// Drives the "Save to Library" action independently of the generate state, so
/// saving a paper never disturbs the rendered result:
///   - `AsyncData(null)`         -> idle (not yet saved),
///   - `AsyncLoading`            -> saving,
///   - `AsyncData(contentId)`    -> saved (non-empty id),
///   - `AsyncError`              -> save failed (offer retry).
@riverpod
class ExamPaperSaveController extends _$ExamPaperSaveController {
  @override
  FutureOr<String?> build() => null;

  Future<void> save(ExamPaperReady ready) async {
    state = const AsyncValue<String?>.loading();
    state = await AsyncValue.guard<String?>(
      () => ref.read(examPaperRepositoryProvider).save(ready),
    );
  }

  /// Reset to idle (called when a fresh paper is generated).
  void reset() => state = const AsyncValue<String?>.data(null);
}
