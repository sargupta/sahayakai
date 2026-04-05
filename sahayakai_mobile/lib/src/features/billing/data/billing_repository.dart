import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';

final billingRepositoryProvider = Provider((ref) {
  return BillingRepository(ref.read(apiClientProvider));
});

class BillingRepository {
  final ApiClient _apiClient;

  BillingRepository(this._apiClient);

  /// POST /billing/create-subscription — create Razorpay subscription.
  /// Returns a short URL for redirect checkout.
  Future<String> createSubscription({required String planId}) async {
    final response = await _apiClient.client.post(
      '/billing/create-subscription',
      data: {'planId': planId},
    );

    if (response.statusCode == 200) {
      return response.data['shortUrl'] as String? ??
          response.data['short_url'] as String? ??
          '';
    }
    throw Exception('Subscription creation failed: ${response.statusCode}');
  }

  /// POST /billing/cancel — cancel active subscription.
  Future<void> cancelSubscription() async {
    final response = await _apiClient.client.post('/billing/cancel');
    if (response.statusCode != 200) {
      throw Exception('Cancellation failed: ${response.statusCode}');
    }
  }
}
