import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/usage_models.dart';

final usageRepositoryProvider = Provider((ref) {
  return UsageRepository(ref.read(apiClientProvider));
});

class UsageRepository {
  final ApiClient _apiClient;

  UsageRepository(this._apiClient);

  /// Get the current user's monthly usage summary and plan-specific limits.
  Future<UsageResponse> getUsage() async {
    final response = await _apiClient.client.get('/usage');

    if (response.statusCode == 200) {
      return UsageResponse.fromJson(response.data as Map<String, dynamic>);
    }
    throw Exception('Failed to fetch usage: ${response.statusCode}');
  }
}

/// Provider for the user's usage data. Refresh by invalidating.
final usageProvider = FutureProvider.autoDispose<UsageResponse>((ref) async {
  final repo = ref.read(usageRepositoryProvider);
  return repo.getUsage();
});
