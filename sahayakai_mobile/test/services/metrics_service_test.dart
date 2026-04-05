import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/services/metrics_service.dart';

void main() {
  group('MetricsService', () {
    // MetricsService is fire-and-forget — failures are silently ignored.
    // These tests verify it doesn't crash, even without a running server.

    test('send does not throw on network error', () async {
      // No server → Dio throws → should be caught silently.
      await MetricsService.send(name: 'test_metric', value: 42.0);
      // If we get here, no exception was thrown. ✓
    });

    test('trackScreenLoad does not throw', () async {
      await MetricsService.trackScreenLoad(
        'HomeScreen',
        const Duration(milliseconds: 350),
      );
    });

    test('trackApiLatency does not throw', () async {
      await MetricsService.trackApiLatency(
        '/ai/lesson-plan',
        const Duration(milliseconds: 2100),
        200,
      );
    });

    test('trackStartup does not throw', () async {
      await MetricsService.trackStartup(
        const Duration(milliseconds: 1500),
      );
    });
  });
}
