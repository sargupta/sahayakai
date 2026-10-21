import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/rubric_repository.dart';
import '../domain/rubric.dart';

part 'rubric_controller.g.dart';

/// Drives the rubric screen through `AsyncValue<Rubric?>`:
///   - `AsyncData(null)`     -> empty / idle (initial),
///   - `AsyncLoading`        -> long-running skeleton (server maxDuration 120 s),
///   - `AsyncError`          -> typed `ApiException` the view maps to the right UI,
///   - `AsyncData(rubric)`   -> the rendered rubric grid.
@riverpod
class RubricController extends _$RubricController {
  @override
  FutureOr<Rubric?> build() => null;

  Future<void> generate(RubricRequest request) async {
    state = const AsyncValue<Rubric?>.loading();
    state = await AsyncValue.guard<Rubric?>(
      () => ref.read(rubricRepositoryProvider).generate(request),
    );
  }

  /// Return to the empty/idle state.
  void clear() => state = const AsyncValue<Rubric?>.data(null);
}
