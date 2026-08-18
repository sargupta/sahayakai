// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'exam_paper_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$examPaperControllerHash() =>
    r'64a040df1901a76958cffab087db2eb493753762';

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
///
/// Copied from [ExamPaperController].
@ProviderFor(ExamPaperController)
final examPaperControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      ExamPaperController,
      ExamPaperResult?
    >.internal(
      ExamPaperController.new,
      name: r'examPaperControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$examPaperControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$ExamPaperController = AutoDisposeAsyncNotifier<ExamPaperResult?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
