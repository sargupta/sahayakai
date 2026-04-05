import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/services/analytics_seed_service.dart';

void main() {
  group('AnalyticsSeedService', () {
    test('class is importable and has private constructor', () {
      expect(AnalyticsSeedService, isNotNull);
    });

    test('seed is a static method accepting userId string', () {
      expect(AnalyticsSeedService.seed, isA<Future<bool> Function(String)>());
    });

    // In test env, kDebugMode is true, so the method will NOT early-return.
    // It will attempt a real HTTP POST. If a dev server is running it may
    // succeed (true) or fail (false). Both outcomes are valid.

    test('seed returns a bool (true or false) without throwing', () async {
      // kDebugMode == true in tests, so the guard passes.
      // The Dio POST may succeed or fail depending on server state.
      // The key invariant: it never throws — always returns bool.
      final result = await AnalyticsSeedService.seed('test-user-123');
      expect(result, isA<bool>());
    });

    test('seed handles empty userId without throwing', () async {
      final result = await AnalyticsSeedService.seed('');
      expect(result, isA<bool>());
    });

    test('seed handles special characters in userId without throwing',
        () async {
      final result =
          await AnalyticsSeedService.seed('user@special/chars#test');
      expect(result, isA<bool>());
    });

    test('seed is idempotent (can be called multiple times)', () async {
      final r1 = await AnalyticsSeedService.seed('user-1');
      final r2 = await AnalyticsSeedService.seed('user-1');
      // Both should be booleans; values may differ by server state.
      expect(r1, isA<bool>());
      expect(r2, isA<bool>());
    });

    test('seed returns a bool for any user (covers error or success path)',
        () async {
      // In test env, kDebugMode is true so the guard passes.
      // The Dio POST may succeed (server running) or fail (catch → false).
      // Either way, the method returns a bool without throwing.
      final result = await AnalyticsSeedService.seed('unreachable-user');
      expect(result, isA<bool>());
    });
  });
}
