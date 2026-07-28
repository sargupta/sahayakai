import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/api_providers.dart';
import '../domain/account_deletion.dart';
import '../domain/export_result.dart';
import 'settings_dtos.dart';

part 'settings_repository.g.dart';

/// Data-layer gateway for Settings' own concerns: account deletion and the
/// data export that follows it. Presentation talks to the controllers, the
/// controllers to this repository, and only this repository touches
/// [ApiClient]. Errors surface as the typed `ApiException` the client maps
/// from Dio.
///
/// The profile-slice write used to live here too. It moved to
/// `ProfileRepository` (P0.8), which owns the `users/<uid>` document; Settings'
/// `ProfileSaveController` now calls that repository. One document, one owner.
///
/// BUILT-PENDING-FIREBASE. The call below is wired end to end but cannot
/// succeed at runtime yet: `tokenProvider` is the foundation-v1 stub that
/// always returns null, so no `Authorization: Bearer` header is attached and
/// the middleware never injects `x-user-id` — every request 401s. That is the
/// honest current state, not a bug in this layer. See P0.2.
class SettingsRepository {
  const SettingsRepository(this._client);

  final ApiClient _client;

  static const String _deleteAccountPath = '/api/user/delete-account';

  /// Schedules the account for deletion (30-day grace window).
  ///
  /// [idToken] must come from a **fresh re-authentication**, not merely a
  /// force-refreshed token: the route reads the token's `auth_time` claim and
  /// rejects anything older than [kMaxAuthAgeSeconds]. Force-refreshing mints a
  /// new token but carries the ORIGINAL `auth_time` forward, so it does not
  /// satisfy the check. See [deleteAccountControllerProvider].
  ///
  /// Every re-auth failure comes back as **401**, not 403, carrying
  /// `{"error": "reauth_required"}` — so the UI branches on
  /// `ApiErrorKind.unauthorized`, never on `forbidden`.
  Future<AccountDeletion> deleteAccount({required String idToken}) {
    return _client.post<AccountDeletion>(
      _deleteAccountPath,
      data: DeleteAccountRequestDto(idToken: idToken).toJson(),
      decode: (json) => DeleteAccountResponseDto.fromJson(json).toDomain(),
    );
  }

  /// Triggers the real data export.
  ///
  /// `GET /api/export` is NOT this call on purpose — it only returns a JSON
  /// stats estimate (`totalItems`, `countsByType`, ...), never the archive.
  /// `POST /api/export` is the actual trigger, and it must go through this
  /// authenticated [ApiClient] (which carries a real Bearer token the
  /// middleware forwards as `x-user-id`) rather than an external browser tab,
  /// which carries neither the token nor the web-only session cookie the
  /// route also accepts.
  ///
  /// [path] is the server-supplied `exportUrl` from the delete-account
  /// response (normally `/api/export`) — passed through rather than
  /// hardcoded here so the client keeps honoring whatever the server points
  /// it at.
  ///
  /// See [ExportResult] for what the two possible response shapes mean.
  Future<ExportResult> requestExport(String path) async {
    final raw = await _client.postRaw(path);
    final contentType = raw.contentType ?? '';

    if (contentType.contains('zip')) {
      return ExportArchiveReady(
        bytes: raw.bytes,
        filename: raw.filename ?? _fallbackExportFilename(),
      );
    }

    // Anything else is expected to be the JSON `{ jobId, status: 'pending' }'
    // queued-job body. Decoded leniently: a shape this client doesn't
    // recognize surfaces as a typed error instead of silently doing nothing.
    Map<String, dynamic>? json;
    try {
      final decoded = jsonDecode(utf8.decode(raw.bytes));
      if (decoded is Map<String, dynamic>) json = decoded;
    } catch (_) {
      json = null;
    }
    final jobId = json?['jobId'] as String?;
    if (jobId != null && jobId.isNotEmpty) {
      return ExportJobQueued(jobId);
    }

    throw const ApiException(
      ApiErrorKind.badResponse,
      'Unexpected export response.',
    );
  }
}

String _fallbackExportFilename() {
  final today = DateTime.now().toIso8601String().split('T').first;
  return 'sahayakai_export_$today.zip';
}

@riverpod
SettingsRepository settingsRepository(Ref ref) {
  return SettingsRepository(ref.watch(apiClientProvider));
}
