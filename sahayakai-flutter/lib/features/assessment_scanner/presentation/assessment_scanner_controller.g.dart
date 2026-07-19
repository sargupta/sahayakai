// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'assessment_scanner_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$assessmentScannerControllerHash() =>
    r'd29449997ccbcf848ea923c2b1c7fb6d94c6c82b';

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
///
/// Copied from [AssessmentScannerController].
@ProviderFor(AssessmentScannerController)
final assessmentScannerControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      AssessmentScannerController,
      AssessmentResult?
    >.internal(
      AssessmentScannerController.new,
      name: r'assessmentScannerControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$assessmentScannerControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$AssessmentScannerController =
    AutoDisposeAsyncNotifier<AssessmentResult?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
