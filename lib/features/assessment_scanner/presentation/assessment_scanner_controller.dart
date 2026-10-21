import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/assessment_scanner_repository.dart';
import '../domain/assessment_scan.dart';

part 'assessment_scanner_controller.g.dart';

/// Drives the Assessment Scanner screen through `AsyncValue<AssessmentResult?>`:
///   - `AsyncData(null)`      -> empty / idle (initial, and after [clear]),
///   - `AsyncLoading`         -> the grading skeleton (multi-page OCR + rubric
///                               scoring is the slowest path on the backend),
///   - `AsyncError`           -> the typed `ApiException` the view maps to the
///                               right recovery UI,
///   - `AsyncData(result)`    -> the rendered scorecard.
///
/// The transient form state (the captured pages, subject, grade, language,
/// answer key) lives in the screen's `State`, mirroring the Assess Assignment
/// tool — this notifier owns only the async grading outcome so it composes with
/// the shared `ResultView`.
@riverpod
class AssessmentScannerController extends _$AssessmentScannerController {
  @override
  FutureOr<AssessmentResult?> build() => null;

  Future<void> grade(AssessmentScanRequest request) async {
    state = const AsyncValue<AssessmentResult?>.loading();
    state = await AsyncValue.guard<AssessmentResult?>(
      () => ref.read(assessmentScannerRepositoryProvider).grade(request),
    );
  }

  /// Return to the empty/idle state.
  void clear() => state = const AsyncValue<AssessmentResult?>.data(null);
}
