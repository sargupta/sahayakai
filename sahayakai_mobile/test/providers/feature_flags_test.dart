import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/core/network/api_client.dart';
import 'package:sahayakai_mobile/src/core/providers/feature_flags_provider.dart';
import '../helpers/mocks.dart';

void main() {
  group('FeatureFlags', () {
    test('fromJson parses all fields', () {
      final flags = FeatureFlags.fromJson({
        'subscriptionEnabled': true,
        'subscriptionReason': 'active',
        'maintenanceMode': false,
        'maintenanceMessage': '',
        'features': {
          'visual-aid': true,
          'exam-paper': false,
          'beta-vidya': true,
        },
      });

      expect(flags.subscriptionEnabled, true);
      expect(flags.subscriptionReason, 'active');
      expect(flags.maintenanceMode, false);
      expect(flags.maintenanceMessage, '');
      expect(flags.isEnabled('visual-aid'), true);
      expect(flags.isEnabled('exam-paper'), false);
      expect(flags.isEnabled('beta-vidya'), true);
      expect(flags.isEnabled('nonexistent'), false);
    });

    test('fromJson defaults safely on empty/null', () {
      final flags = FeatureFlags.fromJson({});

      expect(flags.subscriptionEnabled, false);
      expect(flags.subscriptionReason, isNull);
      expect(flags.maintenanceMode, false);
      expect(flags.maintenanceMessage, isNull);
      expect(flags.features, isEmpty);
    });

    test('const default constructor is safe', () {
      const flags = FeatureFlags();

      expect(flags.subscriptionEnabled, false);
      expect(flags.subscriptionReason, isNull);
      expect(flags.maintenanceMode, false);
      expect(flags.maintenanceMessage, isNull);
      expect(flags.isEnabled('anything'), false);
    });

    test('fromJson handles null subscription fields', () {
      final flags = FeatureFlags.fromJson({
        'subscriptionEnabled': null,
        'maintenanceMode': null,
      });

      expect(flags.subscriptionEnabled, false);
      expect(flags.maintenanceMode, false);
    });

    test('fromJson handles features with non-true values as false', () {
      final flags = FeatureFlags.fromJson({
        'features': {
          'enabled-feature': true,
          'disabled-feature': false,
          'string-value': 'yes', // not bool true
          'null-value': null,
        },
      });

      expect(flags.isEnabled('enabled-feature'), true);
      expect(flags.isEnabled('disabled-feature'), false);
      expect(flags.isEnabled('string-value'), false);
      expect(flags.isEnabled('null-value'), false);
    });

    test('fromJson with maintenanceMode true', () {
      final flags = FeatureFlags.fromJson({
        'maintenanceMode': true,
        'maintenanceMessage': 'Scheduled maintenance until 5 PM',
      });

      expect(flags.maintenanceMode, true);
      expect(
          flags.maintenanceMessage, 'Scheduled maintenance until 5 PM');
    });

    test('isEnabled returns false for missing key', () {
      const flags = FeatureFlags(features: {'a': true});
      expect(flags.isEnabled('b'), false);
    });
  });

  group('featureFlagsProvider', () {
    test('returns parsed flags on successful API call', () async {
      final mocks = createMockApiClient();
      when(() => mocks.dio.get(any())).thenAnswer(
        (_) async => successResponse<Map<String, dynamic>>({
          'subscriptionEnabled': true,
          'maintenanceMode': false,
          'features': {'quiz': true, 'exam-paper': false},
        }),
      );

      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mocks.apiClient),
        ],
      );
      addTearDown(container.dispose);

      final flags = await container.read(featureFlagsProvider.future);

      expect(flags.subscriptionEnabled, true);
      expect(flags.maintenanceMode, false);
      expect(flags.isEnabled('quiz'), true);
      expect(flags.isEnabled('exam-paper'), false);
    });

    test('returns safe defaults on API error', () async {
      final mocks = createMockApiClient();
      when(() => mocks.dio.get(any())).thenThrow(Exception('Network error'));

      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mocks.apiClient),
        ],
      );
      addTearDown(container.dispose);

      final flags = await container.read(featureFlagsProvider.future);

      expect(flags.subscriptionEnabled, false);
      expect(flags.maintenanceMode, false);
      expect(flags.features, isEmpty);
    });

    test('returns safe defaults on non-200 response', () async {
      final mocks = createMockApiClient();
      when(() => mocks.dio.get(any())).thenAnswer(
        (_) async => successResponse<Map<String, dynamic>>(
          {'subscriptionEnabled': true},
          statusCode: 500,
        ),
      );

      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(mocks.apiClient),
        ],
      );
      addTearDown(container.dispose);

      final flags = await container.read(featureFlagsProvider.future);

      // Non-200 falls through to default.
      expect(flags.subscriptionEnabled, false);
      expect(flags.features, isEmpty);
    });
  });
}
