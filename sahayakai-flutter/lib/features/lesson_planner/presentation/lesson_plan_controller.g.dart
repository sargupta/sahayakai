// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lesson_plan_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$lessonPlanControllerHash() =>
    r'2cbb335356d5a9960d8011a718eb431fbac30677';

/// Drives the lesson-plan screen through `AsyncValue<LessonPlan?>`:
///   - `AsyncData(null)`  -> empty / idle (initial),
///   - `AsyncLoading`     -> long-running skeleton (server maxDuration 120 s),
///   - `AsyncError`       -> typed `ApiException` the view maps to the right UI,
///   - `AsyncData(plan)`  -> the rendered plan.
///
/// Copied from [LessonPlanController].
@ProviderFor(LessonPlanController)
final lessonPlanControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      LessonPlanController,
      LessonPlan?
    >.internal(
      LessonPlanController.new,
      name: r'lessonPlanControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$lessonPlanControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$LessonPlanController = AutoDisposeAsyncNotifier<LessonPlan?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
