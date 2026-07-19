import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/virtual_field_trip.dart';
import 'virtual_field_trip_dtos.dart';

part 'virtual_field_trip_repository.g.dart';

/// Data-layer gateway for the Virtual Field Trip tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient].
///
/// Two SUCCESS shapes arrive here, distinguished at the decode boundary:
///   • a 200 `{ title, stops, gradeLevel, subject }` -> [FieldTripResult].
///   • a 202 `{ error: 'still_generating', message, ... }` -> the distinct
///     [FieldTripStillGenerating] outcome. Because the client's `validateStatus`
///     accepts anything < 400, the 202 is NOT a Dio error — it flows through
///     `decode` like a 200, so the shape check here is what separates them.
///
/// Every real error (401 signed-out, 403 plan gate, 429 limit, 5xx/503 busy,
/// 400/422, network, timeout) still arrives as the typed `ApiException` the
/// client maps from Dio, and the error view branches on it.
class VirtualFieldTripRepository {
  const VirtualFieldTripRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/virtual-field-trip';

  Future<FieldTripOutcome> plan(VirtualFieldTripRequest request) {
    return _client.post<FieldTripOutcome>(
      _path,
      data: VirtualFieldTripRequestDto.fromDomain(request).toJson(),
      decode: (json) {
        // The benign 202 rides the success path (status < 400). Route it to the
        // distinct outcome by its `error` code before the itinerary decode —
        // a real 200 never carries `error`, and this body carries no `stops`.
        if (json['error'] == kStillGeneratingCode) {
          return FieldTripStillGeneratingDto.fromJson(json).toDomain();
        }
        return FieldTripResult(
          VirtualFieldTripResponseDto.fromJson(json).toDomain(),
        );
      },
    );
  }
}

@riverpod
VirtualFieldTripRepository virtualFieldTripRepository(Ref ref) {
  return VirtualFieldTripRepository(ref.watch(apiClientProvider));
}
