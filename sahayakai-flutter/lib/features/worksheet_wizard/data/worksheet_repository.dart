import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/worksheet.dart';
import 'worksheet_dtos.dart';

part 'worksheet_repository.g.dart';

/// Data-layer gateway for the worksheet tool. Presentation talks to the
/// controller, the controller to this repository, and only this repository
/// touches [ApiClient]. Errors surface as the typed `ApiException` the client
/// already maps from Dio.
class WorksheetRepository {
  const WorksheetRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/ai/worksheet';
  static const String _savePath = '/api/content/save';

  Future<Worksheet> generate(WorksheetRequest request) {
    return _client.post<Worksheet>(
      _path,
      // Carry the verbatim body onto the domain so a later Save persists the
      // exact `data: output` the backend flow does.
      decode: (json) => WorksheetResponseDto.fromJson(json).toDomain(raw: json),
      data: WorksheetRequestDto.fromDomain(request).toJson(),
    );
  }

  /// Save a generated worksheet to the teacher's library via
  /// `POST /api/content/save`. The body mirrors the `dbAdapter.saveContent`
  /// call in `sahayakai-main/src/ai/flows/worksheet-wizard.ts` field-for-field
  /// (`type: 'worksheet'`, `data: <the model output>`), so the Library reads it
  /// back through `mapSavedWorksheet` unchanged. Returns the new `contentId`
  /// the endpoint echoes as `id`. Throws `ApiException` on failure.
  ///
  /// [prompt] is the generation request's prompt — the backend derives both the
  /// saved `topic` and the `Worksheet: …` title from it. Grade/subject prefer
  /// the model's own values and fall back to the request / the flow's defaults.
  Future<String> save({
    required Worksheet worksheet,
    required String prompt,
    String? gradeLevel,
    String? language,
  }) {
    final trimmedPrompt = prompt.trim();
    final titleSeed = trimmedPrompt.length <= 30
        ? trimmedPrompt
        : trimmedPrompt.substring(0, 30);
    final body = <String, dynamic>{
      'id': _uuidV4(),
      'type': 'worksheet',
      'title': 'Worksheet: $titleSeed',
      'gradeLevel': worksheet.gradeLevel ?? gradeLevel ?? 'Class 5',
      'subject': worksheet.subject ?? 'General',
      'topic': trimmedPrompt,
      'language': (language == null || language.trim().isEmpty)
          ? 'English'
          : language.trim(),
      'isPublic': false,
      'isDraft': false,
      // The full model output — exactly what the flow persists as `data`.
      'data': worksheet.raw,
    };
    return _client.post<String>(
      _savePath,
      data: body,
      decode: (json) => (json['id'] as String?)?.trim() ?? '',
    );
  }
}

/// A RFC-4122 version-4 UUID, generated without a package dependency. The
/// `/api/content/save` schema requires `id` to be a valid UUID
/// (`z.string().uuid()`), so the format (version + variant bits) matters.
String _uuidV4() {
  final rnd = math.Random.secure();
  final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

@riverpod
WorksheetRepository worksheetRepository(Ref ref) {
  return WorksheetRepository(ref.watch(apiClientProvider));
}
