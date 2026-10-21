import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/api_providers.dart';
import '../domain/parent_outreach.dart';
import 'dto/outreach_dtos.dart';
import 'parent_hotline_errors.dart';

part 'parent_hotline_repository.g.dart';

/// Data-layer gateway for the Parent Hotline pillar. Presentation talks to the
/// controller (U-PH2), the controller to this repository, and only this
/// repository touches [ApiClient].
///
/// The four bound routes (all under `/api/attendance/*`):
///   • `createOutreach`   → POST `outreach`        → `outreachId`
///   • `placeCall`        → POST `call`            → `callSid`
///   • `pollSummary`      → GET  `call-summary`    → [CallResult]
///   • `latestForStudent` → GET  `outreach-latest` → [LatestOutreach]?
///
/// `createOutreach` / `placeCall` translate the transport [ApiException] into a
/// branchable [ParentHotlineException] for the cases the controller cares about
/// (premium, no-phone, dedup, unsupported-language, telephony-not-configured,
/// call-failed, not-found); every other error — including **401 auth** — is
/// rethrown as the original [ApiException] (see `parent_hotline_errors.dart`).
///
/// The message-draft step (`POST /api/ai/parent-message`) is intentionally NOT
/// here — it stays `parentMessageRepositoryProvider` (SPEC B.2). Auth: the
/// shared `AuthInterceptor` injects the bearer token; in foundation-v1 the token
/// is stubbed, so against a real backend these routes 401 until auth lands.
class ParentHotlineRepository {
  const ParentHotlineRepository(this._client);

  final ApiClient _client;

  static const String _outreachPath = '/api/attendance/outreach';
  static const String _callPath = '/api/attendance/call';
  static const String _callSummaryPath = '/api/attendance/call-summary';
  static const String _latestPath = '/api/attendance/outreach-latest';

  /// Persists the outreach doc. Returns the `outreachId` — the join key for
  /// every subsequent call route. Maps `403 PREMIUM_REQUIRED`, `404`,
  /// `422 no-phone`, `429 dedup(retryAfterSeconds)` to typed errors.
  Future<String> createOutreach(CreateOutreachRequestDto req) async {
    try {
      final id = await _client.post<String>(
        _outreachPath,
        data: req.toJson(),
        decode: (json) => CreateOutreachResponseDto.fromJson(json).id,
      );
      if (id.isEmpty) {
        // A 200 with no id is a malformed success — surface it, don't return "".
        throw const ApiException(
          ApiErrorKind.badResponse,
          'The outreach could not be created.',
        );
      }
      return id;
    } on ApiException catch (e) {
      throw ParentHotlineException.fromCreateOutreach(e) ?? e;
    }
  }

  /// Places the call for an existing outreach. Sends ONLY
  /// `{ outreachId, parentLanguage }` — never the phone (F9-001). Returns the
  /// provider `callSid`. Maps `422 unsupported-language`, `422 no-valid-phone`,
  /// `502`, `503` to typed errors.
  Future<String> placeCall({
    required String outreachId,
    required String parentLanguage,
  }) async {
    try {
      return await _client.post<String>(
        _callPath,
        data: PlaceCallRequestDto(
          outreachId: outreachId,
          parentLanguage: parentLanguage,
        ).toJson(),
        decode: (json) => PlaceCallResponseDto.fromJson(json).sid,
      );
    } on ApiException catch (e) {
      throw ParentHotlineException.fromPlaceCall(e,
              parentLanguage: parentLanguage) ??
          e;
    }
  }

  /// Polls the call transcript + summary for [outreachId]. The controller drives
  /// the cadence; this is one shot. Errors surface as the typed [ApiException].
  Future<CallResult> pollSummary(String outreachId) {
    return _client.get<CallResult>(
      _callSummaryPath,
      query: <String, dynamic>{'outreachId': outreachId},
      decode: (json) => CallResultDto.fromJson(_asMap(json)).toDomain(),
    );
  }

  /// The most recent resumable outreach for [studentId] (within the server's
  /// 24h window). Returns null when there is nothing to resume
  /// (`{ outreachId: null }`). Lets the controller jump straight to a completed
  /// summary or re-bind polling to an in-flight call on screen open.
  Future<LatestOutreach?> latestForStudent(String studentId) {
    return _client.get<LatestOutreach?>(
      _latestPath,
      query: <String, dynamic>{'studentId': studentId},
      decode: (json) => LatestOutreachDto.fromJson(_asMap(json)).toDomain(),
    );
  }

  /// The GET routes always return a JSON object; tolerate a non-map defensively
  /// so a shapeless body degrades to empty defaults instead of a cast crash.
  static Map<String, dynamic> _asMap(dynamic json) =>
      json is Map ? json.cast<String, dynamic>() : const <String, dynamic>{};
}

@riverpod
ParentHotlineRepository parentHotlineRepository(Ref ref) {
  return ParentHotlineRepository(ref.watch(apiClientProvider));
}
