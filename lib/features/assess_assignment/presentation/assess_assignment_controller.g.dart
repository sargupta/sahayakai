// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'assess_assignment_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$assessAssignmentControllerHash() =>
    r'dc3bb10a552d4c5d6e5946845981de7d3f7afc41';

/// Drives the Assess Assignment screen through `AsyncValue<Assessment?>`:
///   - `AsyncData(null)`        -> empty / idle (initial),
///   - `AsyncLoading`           -> long-running skeleton (gemini-2.5-pro is the
///                                 slowest, most expensive SKU on the backend),
///   - `AsyncError`             -> typed `ApiException` the view maps to the
///                                 right recovery UI,
///   - `AsyncData(assessment)`  -> the rendered scorecard.
///
/// Copied from [AssessAssignmentController].
@ProviderFor(AssessAssignmentController)
final assessAssignmentControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      AssessAssignmentController,
      Assessment?
    >.internal(
      AssessAssignmentController.new,
      name: r'assessAssignmentControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$assessAssignmentControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$AssessAssignmentController = AutoDisposeAsyncNotifier<Assessment?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
