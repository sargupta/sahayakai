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

  Future<Worksheet> generate(WorksheetRequest request) {
    return _client.post<Worksheet>(
      _path,
      data: WorksheetRequestDto.fromDomain(request).toJson(),
      decode: (json) => WorksheetResponseDto.fromJson(json).toDomain(),
    );
  }
}

@riverpod
WorksheetRepository worksheetRepository(Ref ref) {
  return WorksheetRepository(ref.watch(apiClientProvider));
}
