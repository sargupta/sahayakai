import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:sahayakai_mobile/src/features/usage/data/usage_repository.dart';
import 'package:sahayakai_mobile/src/features/usage/domain/usage_models.dart';
import 'package:sahayakai_mobile/src/features/usage/presentation/screens/usage_screen.dart';
import '../helpers/test_utils.dart';

void main() {
  group('UsageScreen', () {
    testWidgets('shows plan badge and feature bars', (tester) async {
      await pumpTestApp(
        tester,
        const UsageScreen(),
        overrides: [
          usageProvider.overrideWith((_) async => const UsageResponse(
                plan: 'pro',
                model: 'gemini-2.0-flash',
                features: {
                  'lesson-plan': FeatureUsage(used: 8, limit: 25),
                  'quiz': FeatureUsage(used: 3, limit: 15),
                },
              )),
        ],
      );
      await tester.pump();

      expect(find.text('PRO Plan'), findsOneWidget);
      expect(find.text('Lesson Plans'), findsOneWidget);
      expect(find.text('8 / 25'), findsOneWidget);
      expect(find.text('Quizzes'), findsOneWidget);
      expect(find.text('3 / 15'), findsOneWidget);
    });

    testWidgets('shows upgrade button for free plan', (tester) async {
      await pumpTestApp(
        tester,
        const UsageScreen(),
        overrides: [
          usageProvider.overrideWith((_) async => const UsageResponse(plan: 'free', features: {})),
        ],
      );
      await tester.pump();

      expect(find.text('FREE Plan'), findsOneWidget);
      expect(find.text('Upgrade'), findsOneWidget);
    });

    testWidgets('shows unlimited correctly', (tester) async {
      await pumpTestApp(
        tester,
        const UsageScreen(),
        overrides: [
          usageProvider.overrideWith((_) async => const UsageResponse(
                plan: 'gold',
                features: {
                  'lesson-plan': FeatureUsage(used: 50, isUnlimited: true),
                },
              )),
        ],
      );
      await tester.pump();

      expect(find.text('50 used'), findsOneWidget);
    });
  });
}
