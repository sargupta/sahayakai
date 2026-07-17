import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/assess_assignment_repository.dart';
import '../domain/assessment.dart';

part 'assess_assignment_controller.g.dart';

/// Drives the Assess Assignment screen through `AsyncValue<Assessment?>`:
///   - `AsyncData(null)`        -> empty / idle (initial),
///   - `AsyncLoading`           -> long-running skeleton (gemini-2.5-pro is the
///                                 slowest, most expensive SKU on the backend),
///   - `AsyncError`             -> typed `ApiException` the view maps to the
///                                 right recovery UI,
///   - `AsyncData(assessment)`  -> the rendered scorecard.
@riverpod
class AssessAssignmentController extends _$AssessAssignmentController {
  @override
  FutureOr<Assessment?> build() => null;

  Future<void> assess(AssessAssignmentRequest request) async {
    state = const AsyncValue<Assessment?>.loading();
    state = await AsyncValue.guard<Assessment?>(
      () => ref.read(assessAssignmentRepositoryProvider).assess(request),
    );
  }

  /// Return to the empty/idle state.
  void clear() => state = const AsyncValue<Assessment?>.data(null);
}
