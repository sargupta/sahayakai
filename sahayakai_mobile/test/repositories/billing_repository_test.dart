import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/billing/data/billing_repository.dart';
import '../helpers/mocks.dart';

void main() {
  late BillingRepository repo;
  late MockDio mockDio;

  setUp(() {
    final mocks = createMockApiClient();
    mockDio = mocks.dio;
    repo = BillingRepository(mocks.apiClient);
  });

  group('BillingRepository', () {
    test('createSubscription returns checkout URL', () async {
      when(() => mockDio.post(
            '/billing/create-subscription',
            data: any(named: 'data'),
          )).thenAnswer((_) async => successResponse({
            'shortUrl': 'https://rzp.io/checkout/abc123',
          }));

      final url = await repo.createSubscription(planId: 'pro_monthly');
      expect(url, contains('rzp.io'));
    });

    test('createSubscription handles short_url variant', () async {
      when(() => mockDio.post(
            '/billing/create-subscription',
            data: any(named: 'data'),
          )).thenAnswer((_) async => successResponse({
            'short_url': 'https://rzp.io/checkout/xyz',
          }));

      final url = await repo.createSubscription(planId: 'gold_annual');
      expect(url, contains('rzp.io'));
    });

    test('cancelSubscription succeeds', () async {
      when(() => mockDio.post('/billing/cancel'))
          .thenAnswer((_) async => successResponse({'success': true}));

      await repo.cancelSubscription();
      verify(() => mockDio.post('/billing/cancel')).called(1);
    });

    test('cancelSubscription throws on failure', () async {
      when(() => mockDio.post('/billing/cancel'))
          .thenAnswer((_) async => successResponse(null, statusCode: 400));

      expect(() => repo.cancelSubscription(), throwsException);
    });

    test('createSubscription throws on non-200 status', () async {
      when(() => mockDio.post(
            '/billing/create-subscription',
            data: any(named: 'data'),
          )).thenAnswer(
          (_) async => successResponse(null, statusCode: 500));

      expect(
        () => repo.createSubscription(planId: 'pro_monthly'),
        throwsException,
      );
    });

    test('createSubscription returns empty string when no URL in response',
        () async {
      when(() => mockDio.post(
            '/billing/create-subscription',
            data: any(named: 'data'),
          )).thenAnswer((_) async => successResponse(<String, dynamic>{}));

      final url = await repo.createSubscription(planId: 'test');
      expect(url, '');
    });

    test('cancelSubscription sends POST to correct endpoint', () async {
      when(() => mockDio.post('/billing/cancel'))
          .thenAnswer((_) async => successResponse({'success': true}));

      await repo.cancelSubscription();

      verify(() => mockDio.post('/billing/cancel')).called(1);
    });
  });
}
