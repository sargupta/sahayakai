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
///   - `AsyncData(ExamPaperReady)`       -> the rendered paper + save action,
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
String _$examPaperSaveControllerHash() =>
    r'8884c395433632206b15630b99f8c175c6690bda';

/// Drives the "Save to Library" action independently of the generate state, so
/// saving a paper never disturbs the rendered result:
///   - `AsyncData(null)`         -> idle (not yet saved),
///   - `AsyncLoading`            -> saving,
///   - `AsyncData(contentId)`    -> saved (non-empty id),
///   - `AsyncError`              -> save failed (offer retry).
///
/// Copied from [ExamPaperSaveController].
@ProviderFor(ExamPaperSaveController)
final examPaperSaveControllerProvider =
    AutoDisposeAsyncNotifierProvider<ExamPaperSaveController, String?>.internal(
      ExamPaperSaveController.new,
      name: r'examPaperSaveControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$examPaperSaveControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$ExamPaperSaveController = AutoDisposeAsyncNotifier<String?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
