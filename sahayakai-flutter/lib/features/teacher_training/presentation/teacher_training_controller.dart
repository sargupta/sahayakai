import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/teacher_training_repository.dart';
import '../domain/teacher_advice.dart';

part 'teacher_training_controller.g.dart';

/// Drives the Teaching Coach screen through `AsyncValue<TeacherAdvice?>`:
///   - `AsyncData(null)`     -> empty / idle (initial),
///   - `AsyncLoading`        -> long-running skeleton (server maxDuration ~120 s),
///   - `AsyncError`          -> typed `ApiException` the view maps to the right UI
///                              (401 sign-in, 403 upgrade, 429 limit, 503 busy...),
///   - `AsyncData(advice)`   -> the rendered advice.
@riverpod
class TeacherTrainingController extends _$TeacherTrainingController {
  @override
  FutureOr<TeacherAdvice?> build() => null;

  Future<void> ask(TeacherTrainingRequest request) async {
    state = const AsyncValue<TeacherAdvice?>.loading();
    state = await AsyncValue.guard<TeacherAdvice?>(
      () => ref.read(teacherTrainingRepositoryProvider).advise(request),
    );
  }

  /// Return to the empty/idle state.
  void clear() => state = const AsyncValue<TeacherAdvice?>.data(null);
}
