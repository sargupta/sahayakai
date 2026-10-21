// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'teacher_training_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$teacherTrainingControllerHash() =>
    r'8fbaa82245d891d98c55ce494f021eae47152391';

/// Drives the Teaching Coach screen through `AsyncValue<TeacherAdvice?>`:
///   - `AsyncData(null)`     -> empty / idle (initial),
///   - `AsyncLoading`        -> long-running skeleton (server maxDuration ~120 s),
///   - `AsyncError`          -> typed `ApiException` the view maps to the right UI
///                              (401 sign-in, 403 upgrade, 429 limit, 503 busy...),
///   - `AsyncData(advice)`   -> the rendered advice.
///
/// Copied from [TeacherTrainingController].
@ProviderFor(TeacherTrainingController)
final teacherTrainingControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      TeacherTrainingController,
      TeacherAdvice?
    >.internal(
      TeacherTrainingController.new,
      name: r'teacherTrainingControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$teacherTrainingControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$TeacherTrainingController = AutoDisposeAsyncNotifier<TeacherAdvice?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
