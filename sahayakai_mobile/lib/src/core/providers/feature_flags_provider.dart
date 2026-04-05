import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_client.dart';

/// Feature flags from GET /config/flags.
class FeatureFlags {
  final bool subscriptionEnabled;
  final String? subscriptionReason;
  final bool maintenanceMode;
  final String? maintenanceMessage;
  final Map<String, bool> features;

  const FeatureFlags({
    this.subscriptionEnabled = false,
    this.subscriptionReason,
    this.maintenanceMode = false,
    this.maintenanceMessage,
    this.features = const {},
  });

  factory FeatureFlags.fromJson(Map<String, dynamic> json) {
    final rawFeatures = json['features'] as Map<String, dynamic>? ?? {};
    return FeatureFlags(
      subscriptionEnabled: json['subscriptionEnabled'] as bool? ?? false,
      subscriptionReason: json['subscriptionReason'] as String?,
      maintenanceMode: json['maintenanceMode'] as bool? ?? false,
      maintenanceMessage: json['maintenanceMessage'] as String?,
      features: rawFeatures
          .map((k, v) => MapEntry(k, v == true)),
    );
  }

  /// Check if a specific feature is enabled.
  bool isEnabled(String featureName) => features[featureName] ?? false;
}

/// Fetches feature flags. Falls back to safe defaults on error.
final featureFlagsProvider =
    FutureProvider.autoDispose<FeatureFlags>((ref) async {
  try {
    final apiClient = ref.read(apiClientProvider);
    final response = await apiClient.client.get('/config/flags');

    if (response.statusCode == 200) {
      return FeatureFlags.fromJson(response.data as Map<String, dynamic>);
    }
  } catch (_) {
    // Fail open — no paywall, no maintenance on error.
  }

  return const FeatureFlags();
});
