// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'visual_aid_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$visualAidControllerHash() =>
    r'7e4593ee32af39271b9743b7d18a023eda7391cb';

/// Drives the Visual Aid screen through `AsyncValue<VisualAid?>`:
///   - `AsyncData(null)`   -> empty / idle (initial),
///   - `AsyncLoading`      -> image-shaped skeleton,
///   - `AsyncError`        -> typed `ApiException` the view maps to the right
///                            UI (401 signed-out, 403 upgrade, 429 daily/monthly
///                            limit, 422 empty generation, 504/5xx busy),
///   - `AsyncData(aid)`    -> the rendered drawing.
///
/// Copied from [VisualAidController].
@ProviderFor(VisualAidController)
final visualAidControllerProvider =
    AutoDisposeAsyncNotifierProvider<VisualAidController, VisualAid?>.internal(
      VisualAidController.new,
      name: r'visualAidControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$visualAidControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$VisualAidController = AutoDisposeAsyncNotifier<VisualAid?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
