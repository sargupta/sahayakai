import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/services/health_service.dart';

void main() {
  group('HealthStatus', () {
    test('fromJson parses healthy response', () {
      final status = HealthStatus.fromJson({
        'status': 'ok',
        'version': '1.2.3',
        'environment': 'production',
      });

      expect(status.isHealthy, true);
      expect(status.status, 'ok');
      expect(status.version, '1.2.3');
      expect(status.environment, 'production');
    });

    test('fromJson parses degraded status', () {
      final status = HealthStatus.fromJson({'status': 'degraded'});
      expect(status.isHealthy, false);
      expect(status.status, 'degraded');
    });

    test('fromJson parses down status', () {
      final status = HealthStatus.fromJson({'status': 'down'});
      expect(status.isHealthy, false);
      expect(status.status, 'down');
    });

    test('fromJson defaults to unknown when status key is missing', () {
      final status = HealthStatus.fromJson({});
      expect(status.status, 'unknown');
      expect(status.isHealthy, false);
    });

    test('fromJson defaults to unknown when status is null', () {
      final status = HealthStatus.fromJson({'status': null});
      expect(status.status, 'unknown');
      expect(status.isHealthy, false);
    });

    test('const constructor works', () {
      const status = HealthStatus(status: 'down');
      expect(status.isHealthy, false);
      expect(status.version, isNull);
      expect(status.environment, isNull);
    });

    test('isHealthy only returns true for exactly "ok"', () {
      expect(const HealthStatus(status: 'ok').isHealthy, true);
      expect(const HealthStatus(status: 'OK').isHealthy, false);
      expect(const HealthStatus(status: 'Ok').isHealthy, false);
      expect(const HealthStatus(status: 'healthy').isHealthy, false);
      expect(const HealthStatus(status: 'degraded').isHealthy, false);
      expect(const HealthStatus(status: 'down').isHealthy, false);
      expect(const HealthStatus(status: '').isHealthy, false);
    });

    test('fromJson with all optional fields present', () {
      final status = HealthStatus.fromJson({
        'status': 'ok',
        'version': '2.0.0-beta',
        'environment': 'staging',
      });
      expect(status.version, '2.0.0-beta');
      expect(status.environment, 'staging');
    });

    test('fromJson with extra unknown fields does not throw', () {
      final status = HealthStatus.fromJson({
        'status': 'ok',
        'uptime': 99.99,
        'extra_field': true,
      });
      expect(status.isHealthy, true);
    });
  });

  group('QuizHealthStatus', () {
    test('fromJson parses with diagnostics', () {
      final status = QuizHealthStatus.fromJson({
        'status': 'ok',
        'diagnostics': {
          'latency_ms': 150,
          'queue_size': 0,
        },
      });

      expect(status.status, 'ok');
      expect(status.diagnostics, isNotNull);
      expect(status.diagnostics!['latency_ms'], 150);
      expect(status.diagnostics!['queue_size'], 0);
    });

    test('fromJson without diagnostics', () {
      final status = QuizHealthStatus.fromJson({'status': 'ok'});
      expect(status.status, 'ok');
      expect(status.diagnostics, isNull);
    });

    test('fromJson defaults to unknown when status missing', () {
      final status = QuizHealthStatus.fromJson({});
      expect(status.status, 'unknown');
      expect(status.diagnostics, isNull);
    });

    test('fromJson with null status defaults to unknown', () {
      final status = QuizHealthStatus.fromJson({'status': null});
      expect(status.status, 'unknown');
    });

    test('fromJson with empty diagnostics map', () {
      final status = QuizHealthStatus.fromJson({
        'status': 'degraded',
        'diagnostics': <String, dynamic>{},
      });
      expect(status.status, 'degraded');
      expect(status.diagnostics, isEmpty);
    });
  });

  group('HealthService - checkBackendHealth', () {
    test('returns a HealthStatus without throwing', () async {
      // May return 'ok' (server running) or 'down' (no server).
      final status = await HealthService.checkBackendHealth();
      expect(status, isA<HealthStatus>());
      expect(status.status, isA<String>());
      expect(status.status, isNotEmpty);
    });

    test('never throws regardless of server state', () async {
      // The catch block returns HealthStatus(status: 'down') on any error.
      expect(
        () => HealthService.checkBackendHealth(),
        returnsNormally,
      );
    });
  });

  group('HealthService - checkQuizHealth', () {
    test('returns a QuizHealthStatus without throwing', () async {
      final status = await HealthService.checkQuizHealth();
      expect(status, isA<QuizHealthStatus>());
      expect(status.status, isA<String>());
    });

    test('never throws regardless of server state', () async {
      expect(
        () => HealthService.checkQuizHealth(),
        returnsNormally,
      );
    });
  });

  group('HealthService - degraded status branch', () {
    // The service returns HealthStatus(status: 'degraded') when
    // response.statusCode != 200 but the request didn't throw.

    test('HealthStatus with degraded status is not healthy', () {
      const status = HealthStatus(status: 'degraded');
      expect(status.isHealthy, false);
    });

    test('QuizHealthStatus with degraded status', () {
      const status = QuizHealthStatus(status: 'degraded');
      expect(status.status, 'degraded');
    });

    test('degraded is distinct from down and ok', () {
      const degraded = HealthStatus(status: 'degraded');
      const down = HealthStatus(status: 'down');
      const ok = HealthStatus(status: 'ok');
      expect(degraded.status, isNot(down.status));
      expect(degraded.status, isNot(ok.status));
      expect(degraded.isHealthy, false);
      expect(down.isHealthy, false);
      expect(ok.isHealthy, true);
    });
  });

  group('backendHealthProvider', () {
    test('provider can be read from a container', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      // Trigger the provider and wait for completion.
      final status = await container.read(backendHealthProvider.future);
      expect(status, isA<HealthStatus>());
      expect(status.status, isA<String>());
    });
  });
}
