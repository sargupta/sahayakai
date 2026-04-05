/// Monthly usage summary from GET /usage.
class UsageResponse {
  final String plan;
  final bool canExport;
  final bool canViewDetailedAnalytics;
  final bool canAccessAbsenceRecords;
  final bool canUseParentMessaging;
  final String? model; // AI model tier (e.g., 'gemini-2.0-flash')
  final Map<String, FeatureUsage> features;

  const UsageResponse({
    required this.plan,
    this.canExport = false,
    this.canViewDetailedAnalytics = false,
    this.canAccessAbsenceRecords = false,
    this.canUseParentMessaging = false,
    this.model,
    this.features = const {},
  });

  factory UsageResponse.fromJson(Map<String, dynamic> json) {
    final usageRaw = json['usage'] as Map<String, dynamic>? ?? {};
    final features = <String, FeatureUsage>{};

    for (final entry in usageRaw.entries) {
      if (entry.value is Map) {
        features[entry.key] = FeatureUsage.fromJson(
          entry.value as Map<String, dynamic>,
        );
      }
    }

    return UsageResponse(
      plan: json['plan'] as String? ?? 'free',
      canExport: json['canExport'] as bool? ?? false,
      canViewDetailedAnalytics:
          json['canViewDetailedAnalytics'] as bool? ?? false,
      canAccessAbsenceRecords:
          json['canAccessAbsenceRecords'] as bool? ?? false,
      canUseParentMessaging: json['canUseParentMessaging'] as bool? ?? false,
      model: json['model'] as String?,
      features: features,
    );
  }
}

/// Usage stats for a single feature (e.g., lesson-plan: 8/25).
class FeatureUsage {
  final int used;
  final int? limit; // null = unlimited
  final bool isUnlimited;

  const FeatureUsage({
    required this.used,
    this.limit,
    this.isUnlimited = false,
  });

  factory FeatureUsage.fromJson(Map<String, dynamic> json) {
    final limit = json['limit'];
    return FeatureUsage(
      used: json['used'] as int? ?? 0,
      limit: limit is int ? limit : null,
      isUnlimited: limit == null || limit == -1,
    );
  }

  /// Percentage used (0.0 to 1.0). Returns 0 if unlimited.
  double get usagePercent {
    if (isUnlimited || limit == null || limit == 0) return 0;
    return (used / limit!).clamp(0.0, 1.0);
  }

  String get displayText {
    if (isUnlimited) return '$used used';
    return '$used / $limit';
  }
}
