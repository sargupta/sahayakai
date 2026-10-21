import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../../../shared/data/content_id.dart';
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
  static const String _savePath = '/api/content/save';

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
          // Carry the verbatim body onto the domain so a later Save persists the
          // exact `data: output` the backend flow does.
          VirtualFieldTripResponseDto.fromJson(json).toDomain(raw: json),
        );
      },
    );
  }

  /// Save a planned itinerary to the teacher's library via
  /// `POST /api/content/save`. The body mirrors the `dbAdapter.saveContent`
  /// call in `sahayakai-main/src/ai/flows/virtual-field-trip.ts`
  /// field-for-field (`type: 'virtual-field-trip'`, title `output.title`
  /// falling back to `Trip: {topic}`, `gradeLevel: output.gradeLevel ||
  /// input.gradeLevel || 'Class 5'`, `subject: output.subject || 'Geography'`,
  /// topic `input.topic`). Returns the new content id the endpoint echoes as
  /// `id`. Throws `ApiException` on failure.
  ///
  /// KNOWN GAP, stated rather than hidden: this app has no mapper for the
  /// `virtual-field-trip` content type yet (`library_result_mapper.dart` covers
  /// ten types, not this one), so a saved trip appears in the Library list and
  /// opens to the honest "Ready" state instead of re-rendering the itinerary.
  /// The row is real and the payload is intact — the mobile detail view simply
  /// cannot reshape it back yet.
  Future<String> save({
    required FieldTrip trip,
    required VirtualFieldTripRequest request,
  }) {
    final topic = request.topic.trim();
    final language = request.language?.trim() ?? '';
    final body = <String, dynamic>{
      'id': newContentId(),
      'type': 'virtual-field-trip',
      'title': trip.title.isNotEmpty
          ? trip.title
          : 'Trip: ${topic.isEmpty ? 'Untitled' : topic}',
      'gradeLevel': trip.gradeLevel.isNotEmpty
          ? trip.gradeLevel
          : (request.gradeLevel ?? 'Class 5'),
      'subject': trip.subject.isNotEmpty ? trip.subject : 'Geography',
      'topic': topic.isEmpty ? trip.title : topic,
      'language': language.isEmpty ? 'English' : language,
      'isPublic': false,
      'isDraft': false,
      // The full model output — exactly what the flow persists as `data`.
      'data': trip.raw,
    };
    return _client.post<String>(
      _savePath,
      data: body,
      decode: (json) => (json['id'] as String?)?.trim() ?? '',
    );
  }
}

@riverpod
VirtualFieldTripRepository virtualFieldTripRepository(Ref ref) {
  return VirtualFieldTripRepository(ref.watch(apiClientProvider));
}
