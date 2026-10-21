import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/instant_answer_repository.dart';
import '../domain/instant_answer.dart';

part 'instant_answer_controller.g.dart';

/// Drives the Instant Answer screen through `AsyncValue<InstantAnswer?>`:
///   - `AsyncData(null)`    -> empty / idle (initial),
///   - `AsyncLoading`       -> skeleton,
///   - `AsyncError`         -> typed `ApiException` the view maps to the right
///                             UI (notably 429 DAILY_LIMIT_REACHED, which is a
///                             first-class state, not a generic failure),
///   - `AsyncData(answer)`  -> the rendered answer.
@riverpod
class InstantAnswerController extends _$InstantAnswerController {
  @override
  FutureOr<InstantAnswer?> build() => null;

  Future<void> ask(InstantAnswerRequest request) async {
    state = const AsyncValue<InstantAnswer?>.loading();
    state = await AsyncValue.guard<InstantAnswer?>(
      () => ref.read(instantAnswerRepositoryProvider).ask(request),
    );
  }

  /// Return to the empty/idle state.
  void clear() => state = const AsyncValue<InstantAnswer?>.data(null);
}
