import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_client.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/features/settings/domain/export_result.dart';
import 'package:sahayakai/features/settings/presentation/settings_controller.dart';

import '../../support/fake_api_client.dart';

/// [DeleteAccountController] — the real re-auth rewrite (HANDOFF.md §2).
///
/// `confirmDelete()` now calls `FirebaseAuth.instance` /
/// `reauthenticateWithCredential` directly rather than going through an
/// injectable seam, so the credential-exchange branch itself is not
/// reachable from a widget test (there is no Firebase mocking library in this
/// project's dev deps, and adding one is a bigger call than this fix). What
/// IS fully testable, and the thing this rewrite could most easily have
/// gotten wrong, is the guard in front of it: [FirebaseInit.isConfigured] is
/// always false in a widget test (nothing here runs `main()`), so every path
/// through `confirmDelete()` in this suite exercises the SAME early-exit a
/// real device would hit if Firebase itself failed to come up — and it must
/// degrade to the typed `reauth_required` state, never throw an unhandled
/// exception or hang.
void main() {
  ProviderContainer makeContainer() {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    return container;
  }

  group('DeleteAccountController', () {
    test('starts with no attempt made', () {
      final container = makeContainer();
      final state = container.read(deleteAccountControllerProvider);
      expect(state.isLoading, isFalse);
      expect(state.hasError, isFalse);
      expect(state.value, isNull);
    });

    test('Firebase not configured -> settles to a typed reauth_required error, '
        'never throws or hangs', () async {
      final container = makeContainer();
      final notifier = container.read(deleteAccountControllerProvider.notifier);

      // Must not throw synchronously or leave the state stuck loading.
      await notifier.confirmDelete();

      final state = container.read(deleteAccountControllerProvider);
      expect(state.hasError, isTrue);
      expect(state.isLoading, isFalse);
      final error = state.error;
      expect(error, isA<ApiException>());
      expect((error as ApiException).isAuth, isTrue);
      expect(error.message, 'reauth_required');
    });
  });

  /// [ExportDataController] — the fix that replaces the broken
  /// `linkOpenerProvider` (external-browser-tab) export button with a real
  /// `POST /api/export` through the authenticated `ApiClient`.
  group('ExportDataController', () {
    ProviderContainer containerWithClient(FakeApiClient client) {
      final container = ProviderContainer(
        overrides: [apiClientProvider.overrideWithValue(client)],
      );
      addTearDown(container.dispose);
      return container;
    }

    test('starts with no attempt made', () {
      final container = makeContainer();
      final state = container.read(exportDataControllerProvider);
      expect(state.isLoading, isFalse);
      expect(state.hasError, isFalse);
      expect(state.value, isNull);
    });

    test('a ready archive settles to AsyncData(ExportArchiveReady)', () async {
      final client = FakeApiClient(
        postRawResponse: RawResponse(
          bytes: Uint8List.fromList([9, 9, 9]),
          contentType: 'application/zip',
          filename: 'sahayakai_export_2026-07-28.zip',
        ),
      );
      final container = containerWithClient(client);
      final notifier = container.read(exportDataControllerProvider.notifier);

      await notifier.requestExport('/api/export');

      final state = container.read(exportDataControllerProvider);
      expect(state.hasError, isFalse);
      expect(state.isLoading, isFalse);
      expect(state.value, isA<ExportArchiveReady>());
      expect(client.postRaws.single.path, '/api/export');
    });

    test(
      'a transport failure settles to a typed AsyncError, not a hang',
      () async {
        final client = FakeApiClient(
          postRawError: const ApiException(
            ApiErrorKind.server,
            'Something went wrong on our side.',
            statusCode: 500,
          ),
        );
        final container = containerWithClient(client);
        final notifier = container.read(exportDataControllerProvider.notifier);

        await notifier.requestExport('/api/export');

        final state = container.read(exportDataControllerProvider);
        expect(state.hasError, isTrue);
        expect(state.isLoading, isFalse);
      },
    );
  });
}
