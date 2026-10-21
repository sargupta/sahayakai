// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'quiz_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$quizControllerHash() => r'916084182af56968e3ac8b8b5bb9531c92ef86e8';

/// Drives the quiz screen through `AsyncValue<Quiz?>`:
///   - `AsyncData(null)`  -> empty / idle (initial),
///   - `AsyncLoading`     -> long-running skeleton (server maxDuration 120 s),
///   - `AsyncError`       -> typed `ApiException` the view maps to the right UI,
///   - `AsyncData(quiz)`  -> the rendered difficulty variants.
///
/// Copied from [QuizController].
@ProviderFor(QuizController)
final quizControllerProvider =
    AutoDisposeAsyncNotifierProvider<QuizController, Quiz?>.internal(
      QuizController.new,
      name: r'quizControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$quizControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$QuizController = AutoDisposeAsyncNotifier<Quiz?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
