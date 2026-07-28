import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_client.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/features/settings/data/settings_repository.dart';
import 'package:sahayakai/features/settings/domain/export_result.dart';

import '../../support/fake_api_client.dart';

/// `SettingsRepository.requestExport` — the fix for the broken
/// account-deletion "Export my data" button.
///
/// The route it calls, `POST /api/export`
/// (`sahayakai-main/src/app/api/export/route.ts`), returns one of two body
/// shapes under the SAME 200: the actual ZIP archive inline
/// (`application/zip`, the common individual-teacher case, within the
/// server's 500-file cap), or a small JSON `{ jobId, status: 'pending' }`
/// body when the server queued a background job instead (only reachable for a
/// very large export). This suite pins that the repository tells the two
/// apart correctly and never silently drops either.
void main() {
  ProviderContainer containerWith(FakeApiClient client) {
    final container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(client)],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('requestExport — archive returned inline', () {
    test('application/zip -> ExportArchiveReady with the server filename',
        () async {
      final bytes = Uint8List.fromList([1, 2, 3, 4]);
      final client = FakeApiClient(
        postRawResponse: RawResponse(
          bytes: bytes,
          contentType: 'application/zip',
          filename: 'sahayakai_export_2026-07-28.zip',
        ),
      );
      final container = containerWith(client);

      final result =
          await container.read(settingsRepositoryProvider).requestExport(
                '/api/export',
              );

      expect(result, isA<ExportArchiveReady>());
      final archive = result as ExportArchiveReady;
      expect(archive.bytes, bytes);
      expect(archive.filename, 'sahayakai_export_2026-07-28.zip');
      expect(client.postRaws.single.path, '/api/export');
    });

    test('a zip content-type with charset params still matches', () async {
      // Real servers sometimes append parameters; matching must not require
      // an exact string.
      final client = FakeApiClient(
        postRawResponse: RawResponse(
          bytes: Uint8List(0),
          contentType: 'application/zip; charset=binary',
          filename: null,
        ),
      );
      final container = containerWith(client);

      final result = await container
          .read(settingsRepositoryProvider)
          .requestExport('/api/export');

      expect(result, isA<ExportArchiveReady>());
    });

    test('missing Content-Disposition filename falls back to a generated one',
        () async {
      final client = FakeApiClient(
        postRawResponse: RawResponse(
          bytes: Uint8List(0),
          contentType: 'application/zip',
          filename: null,
        ),
      );
      final container = containerWith(client);

      final result = await container
          .read(settingsRepositoryProvider)
          .requestExport('/api/export');

      final archive = result as ExportArchiveReady;
      expect(archive.filename, startsWith('sahayakai_export_'));
      expect(archive.filename, endsWith('.zip'));
    });
  });

  group('requestExport — server queued a background job instead', () {
    test('application/json with a jobId -> ExportJobQueued', () async {
      final body = utf8.encode(jsonEncode({
        'jobId': 'job_abc123',
        'status': 'pending',
        'fileCount': 812,
      }));
      final client = FakeApiClient(
        postRawResponse: RawResponse(
          bytes: Uint8List.fromList(body),
          contentType: 'application/json',
        ),
      );
      final container = containerWith(client);

      final result = await container
          .read(settingsRepositoryProvider)
          .requestExport('/api/export');

      expect(result, isA<ExportJobQueued>());
      expect((result as ExportJobQueued).jobId, 'job_abc123');
    });

    test('a JSON body with no jobId is an unexpected response, not a silent '
        'no-op', () async {
      final body = utf8.encode(jsonEncode({'status': 'ok'}));
      final client = FakeApiClient(
        postRawResponse: RawResponse(
          bytes: Uint8List.fromList(body),
          contentType: 'application/json',
        ),
      );
      final container = containerWith(client);

      expect(
        () => container
            .read(settingsRepositoryProvider)
            .requestExport('/api/export'),
        throwsA(isA<ApiException>()),
      );
    });
  });

  group('requestExport — transport failure', () {
    test('a thrown ApiException (e.g. 401) propagates unchanged', () async {
      const authError = ApiException(
        ApiErrorKind.unauthorized,
        'Please sign in again.',
        statusCode: 401,
      );
      final client = FakeApiClient(postRawError: authError);
      final container = containerWith(client);

      expect(
        () => container
            .read(settingsRepositoryProvider)
            .requestExport('/api/export'),
        throwsA(same(authError)),
      );
    });
  });
}
