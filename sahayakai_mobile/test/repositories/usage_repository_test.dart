import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/usage/data/usage_repository.dart';
import 'package:sahayakai_mobile/src/features/usage/domain/usage_models.dart';
import '../helpers/mocks.dart';

void main() {
  late UsageRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = UsageRepository(mocks.apiClient);
  });

  group('UsageRepository', () {
    test('getUsage parses plan and features', () async {
      when(() => mockDio.get('/usage'))
          .thenAnswer((_) async => successResponse({
                'plan': 'pro',
                'canExport': true,
                'canViewDetailedAnalytics': true,
                'canAccessAbsenceRecords': false,
                'canUseParentMessaging': true,
                'model': 'gemini-2.0-flash',
                'usage': {
                  'lesson-plan': {'used': 8, 'limit': 25},
                  'quiz': {'used': 3, 'limit': 15},
                  'instant-answer': {'used': 12, 'limit': null},
                },
              }));

      final result = await repo.getUsage();

      expect(result.plan, 'pro');
      expect(result.canExport, true);
      expect(result.features['lesson-plan']!.used, 8);
      expect(result.features['lesson-plan']!.limit, 25);
      expect(result.features['lesson-plan']!.usagePercent, closeTo(0.32, 0.01));
      expect(result.features['instant-answer']!.isUnlimited, true);
      expect(result.features['instant-answer']!.displayText, '12 used');
      expect(result.features['lesson-plan']!.displayText, '8 / 25');
    });

    test('getUsage handles empty response', () async {
      when(() => mockDio.get('/usage'))
          .thenAnswer((_) async => successResponse({
                'plan': 'free',
                'usage': {},
              }));

      final result = await repo.getUsage();
      expect(result.plan, 'free');
      expect(result.features, isEmpty);
      expect(result.canExport, false);
    });
  });

  group('FeatureUsage', () {
    test('usagePercent clamps at 1.0', () {
      const usage = FeatureUsage(used: 30, limit: 25);
      expect(usage.usagePercent, 1.0);
    });

    test('usagePercent is 0 for unlimited', () {
      const usage = FeatureUsage(used: 100, isUnlimited: true);
      expect(usage.usagePercent, 0);
    });
  });
}
