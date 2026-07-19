import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/features/profile/data/usage_repository.dart';
import 'package:sahayakai/features/profile/domain/plan_badge.dart';

import '../../support/fake_api_client.dart';

/// Data-layer gates for U-OS1's Plan & usage: what `GET /api/usage` decodes into
/// and how a 401 surfaces. The real [ApiClient] opens a socket, so the fake is
/// not ceremony — an un-faked read fires a live request at production.

/// The `GET /api/usage` body, in the exact shape the route returns (verified
/// against `src/app/api/usage/route.ts` + `src/lib/usage-counters.ts`). The
/// `usage` map is `feature -> { used, limit }`, `limit: -1` meaning unlimited;
/// features with a zero limit are omitted server-side.
Map<String, dynamic> usageJson({String plan = 'free'}) => <String, dynamic>{
      'plan': plan,
      'canExport': false,
      'canViewDetailedAnalytics': false,
      'canAccessAbsenceRecords': false,
      'canUseParentMessaging': false,
      'model': 'gemini-2.5-flash',
      'usage': <String, dynamic>{
        // Server (plan-config) declaration order: metered and unlimited
        // interleaved, so the decode's metered-first regrouping is exercised.
        'lesson-plan': <String, dynamic>{'used': 3, 'limit': 10},
        'quiz': <String, dynamic>{'used': 5, 'limit': 5},
        'instant-answer': <String, dynamic>{'used': 12, 'limit': -1},
        'visual-aid': <String, dynamic>{'used': 0, 'limit': 2},
        'assistant': <String, dynamic>{'used': 40, 'limit': -1},
      },
    };

const ApiException _kUnauthorized = ApiException(
  ApiErrorKind.unauthorized,
  'Please sign in again.',
  statusCode: 401,
);

void main() {
  ProviderContainer containerWith(List<Override> overrides) {
    final container = ProviderContainer(overrides: overrides);
    addTearDown(container.dispose);
    return container;
  }

  group('UsageSummary.fromJson', () {
    test('decodes the plan, the capability flags and the model', () {
      final summary = UsageSummary.fromJson(usageJson(plan: 'pro'));

      expect(summary.plan, PlanBadge.pro);
      expect(summary.plan.isPaid, isTrue);
      expect(summary.canExport, isFalse);
      expect(summary.model, 'gemini-2.5-flash');
    });

    test('reuses the plan-badge mapping (legacy institution -> premium)', () {
      expect(
        UsageSummary.fromJson(usageJson(plan: 'institution')).plan,
        PlanBadge.premium,
      );
      expect(UsageSummary.fromJson(usageJson(plan: 'gold')).plan, PlanBadge.gold);
    });

    test('groups metered features first, each group in server order', () {
      final summary = UsageSummary.fromJson(usageJson());

      // Metered (limit > 0) come first: lesson-plan, quiz, visual-aid — in the
      // order the server sent them; then the unlimited pair.
      expect(
        summary.features.map((f) => f.feature).toList(),
        <String>['lesson-plan', 'quiz', 'visual-aid', 'instant-answer', 'assistant'],
      );
    });

    test('reads used and limit, and computes the meter fraction', () {
      final summary = UsageSummary.fromJson(usageJson());
      final lessonPlan =
          summary.features.firstWhere((f) => f.feature == 'lesson-plan');

      expect(lessonPlan.used, 3);
      expect(lessonPlan.limit, 10);
      expect(lessonPlan.isMetered, isTrue);
      expect(lessonPlan.isUnlimited, isFalse);
      expect(lessonPlan.fraction, closeTo(0.3, 1e-9));
    });

    test('a full feature clamps the fraction to 1, never past the track', () {
      final quiz = UsageSummary.fromJson(usageJson())
          .features
          .firstWhere((f) => f.feature == 'quiz');
      // 5 of 5 used.
      expect(quiz.fraction, 1.0);

      // And an over-quota count (used > limit) still clamps.
      final over = FeatureUsage(feature: 'x', used: 12, limit: 10);
      expect(over.fraction, 1.0);
    });

    test('a -1 limit is unlimited: no fraction, no bar', () {
      final instant = UsageSummary.fromJson(usageJson())
          .features
          .firstWhere((f) => f.feature == 'instant-answer');

      expect(instant.isUnlimited, isTrue);
      expect(instant.isMetered, isFalse);
      expect(instant.fraction, 0);
    });

    test('is tolerant: numeric strings parse, a missing limit is unlimited', () {
      final summary = UsageSummary.fromJson(<String, dynamic>{
        'plan': 'free',
        'usage': <String, dynamic>{
          'quiz': <String, dynamic>{'used': '4', 'limit': 5},
          // A garbled entry with no limit must not invent a "0 / 0" wall — it
          // degrades to unlimited rather than a zero cap.
          'mystery': <String, dynamic>{'used': 2},
        },
      });

      final quiz = summary.features.firstWhere((f) => f.feature == 'quiz');
      expect(quiz.used, 4);
      expect(quiz.limit, 5);

      final mystery = summary.features.firstWhere((f) => f.feature == 'mystery');
      expect(mystery.isUnlimited, isTrue);
    });

    test('an absent or non-map usage yields no features, not a crash', () {
      expect(UsageSummary.fromJson(<String, dynamic>{'plan': 'free'}).features,
          isEmpty);
      expect(
        UsageSummary.fromJson(<String, dynamic>{'plan': 'free', 'usage': 'nope'})
            .features,
        isEmpty,
      );
    });
  });

  group('UsageRepository.fetchUsage', () {
    test('GETs /api/usage and decodes the summary', () async {
      final client = FakeApiClient(getResponse: usageJson(plan: 'pro'));
      final container =
          containerWith([apiClientProvider.overrideWithValue(client)]);

      final summary =
          await container.read(usageRepositoryProvider).fetchUsage();

      expect(summary.plan, PlanBadge.pro);
      expect(summary.features, isNotEmpty);
      expect(client.gets.single.path, '/api/usage');
    });

    test('a 401 surfaces as the typed unauthorized exception (the signed-out cue)',
        () {
      final client = FakeApiClient(error: _kUnauthorized);
      final container =
          containerWith([apiClientProvider.overrideWithValue(client)]);

      expect(
        () => container.read(usageRepositoryProvider).fetchUsage(),
        throwsA(
          isA<ApiException>()
              .having((e) => e.kind, 'kind', ApiErrorKind.unauthorized),
        ),
      );
    });
  });

  group('usageSummaryProvider', () {
    test('resolves to the decoded summary', () async {
      final container = containerWith([
        apiClientProvider.overrideWithValue(FakeApiClient(getResponse: usageJson())),
      ]);

      final summary = await container.read(usageSummaryProvider.future);
      expect(summary.plan, PlanBadge.free);
      expect(summary.features.first.feature, 'lesson-plan');
    });

    test('propagates the 401 so the section can degrade', () {
      final container = containerWith([
        apiClientProvider.overrideWithValue(FakeApiClient(error: _kUnauthorized)),
      ]);

      expect(
        container.read(usageSummaryProvider.future),
        throwsA(isA<ApiException>()
            .having((e) => e.kind, 'kind', ApiErrorKind.unauthorized)),
      );
    });
  });
}
