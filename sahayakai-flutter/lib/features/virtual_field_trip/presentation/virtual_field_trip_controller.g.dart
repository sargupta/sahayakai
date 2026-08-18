// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'virtual_field_trip_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$virtualFieldTripControllerHash() =>
    r'b2426874b6e8e78e56bd143f6fe002e54c87bb31';

/// Drives the Virtual Field Trip screen through `AsyncValue<FieldTripOutcome?>`:
///   - `AsyncData(null)`                       -> idle / empty (initial),
///   - `AsyncLoading`                          -> itinerary-shaped skeleton,
///   - `AsyncError`                            -> typed `ApiException` the view
///                                                maps to the right recovery
///                                                (401 sign-in, 429 limit, 5xx
///                                                busy, network offline),
///   - `AsyncData(FieldTripResult)`            -> the rendered itinerary,
///   - `AsyncData(FieldTripStillGenerating)`   -> the calm "check My Library"
///                                                panel (the benign 202, NOT an
///                                                error).
///
/// Modelling the still-generating 202 as a DATA outcome (a [FieldTripOutcome]
/// variant) — not an `AsyncError` — is deliberate: the teacher's trip is being
/// saved server-side, so it must never render as a red failure.
///
/// Copied from [VirtualFieldTripController].
@ProviderFor(VirtualFieldTripController)
final virtualFieldTripControllerProvider =
    AutoDisposeAsyncNotifierProvider<
      VirtualFieldTripController,
      FieldTripOutcome?
    >.internal(
      VirtualFieldTripController.new,
      name: r'virtualFieldTripControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$virtualFieldTripControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$VirtualFieldTripController =
    AutoDisposeAsyncNotifier<FieldTripOutcome?>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
