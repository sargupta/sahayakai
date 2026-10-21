import 'dart:async';

import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/virtual_field_trip_repository.dart';
import '../domain/virtual_field_trip.dart';

part 'virtual_field_trip_controller.g.dart';

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
@riverpod
class VirtualFieldTripController extends _$VirtualFieldTripController {
  @override
  FutureOr<FieldTripOutcome?> build() => null;

  Future<void> plan(VirtualFieldTripRequest request) async {
    state = const AsyncValue<FieldTripOutcome?>.loading();
    state = await AsyncValue.guard<FieldTripOutcome?>(
      () => ref.read(virtualFieldTripRepositoryProvider).plan(request),
    );
  }

  /// Return to the empty/idle state (the footer's Done action).
  void clear() => state = const AsyncValue<FieldTripOutcome?>.data(null);
}
