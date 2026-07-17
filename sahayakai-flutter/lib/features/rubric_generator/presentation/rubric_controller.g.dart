// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rubric_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$rubricControllerHash() => r'c03b88c2f634f77a583269da7acd1ebf0b220721';

/// Drives the rubric screen through `AsyncValue<Rubric?>`:
///   - `AsyncData(null)`     -> empty / idle (initial),
///   - `AsyncLoading`        -> long-running skeleton (server maxDuration 120 s),
///   - `AsyncError`          -> typed `ApiException` the view maps to the right UI,
///   - `AsyncData(rubric)`   -> the rendered rubric grid.
///
/// Copied from [RubricController].
@ProviderFor(RubricController)
final rubricControllerProvider =
    AutoDisposeAsyncNotifierProvider<RubricController, Rubric?>.internal(
      RubricController.new,
      name: r'rubricControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$rubricControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$RubricController = AutoDisposeAsyncNotifier<Rubric?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
