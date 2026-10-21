// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'instant_answer_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$instantAnswerControllerHash() =>
    r'a60b6f6a0a6c14729002902528625ce5a1a17faf';

/// Drives the Instant Answer screen through `AsyncValue<InstantAnswer?>`:
///   - `AsyncData(null)`    -> empty / idle (initial),
///   - `AsyncLoading`       -> skeleton,
///   - `AsyncError`         -> typed `ApiException` the view maps to the right
///                             UI (notably 429 DAILY_LIMIT_REACHED, which is a
///                             first-class state, not a generic failure),
///   - `AsyncData(answer)`  -> the rendered answer.
///
/// Copied from [InstantAnswerController].
@ProviderFor(InstantAnswerController)
final instantAnswerControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      InstantAnswerController,
      InstantAnswer?
    >.internal(
      InstantAnswerController.new,
      name: r'instantAnswerControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$instantAnswerControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$InstantAnswerController = AutoDisposeAsyncNotifier<InstantAnswer?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
