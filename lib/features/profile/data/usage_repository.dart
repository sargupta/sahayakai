import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/plan_badge.dart';

part 'usage_repository.g.dart';

/// One metered feature, as `GET /api/usage` reports it for the current month.
///
/// The wire shape is `{ used: number, limit: number }` (verified against
/// `src/lib/usage-counters.ts` -> `getUserUsageSummary`). `limit == -1` is the
/// backend's sentinel for "unlimited"; `plan-config.ts` skips any feature whose
/// limit is `0` (not available on the plan), so a feature that reaches this app
/// is always either metered (`limit > 0`) or unlimited (`limit < 0`).
class FeatureUsage {
  const FeatureUsage({
    required this.feature,
    required this.used,
    required this.limit,
  });

  /// The kebab-case `GatedFeature` key (`lesson-plan`, `quiz`, `avatar`…). Kept
  /// as the raw server key so a feature this build has not heard of yet still
  /// renders (humanized) instead of being dropped.
  final String feature;

  /// Count consumed this calendar month.
  final int used;

  /// The plan's monthly cap. `-1` = unlimited (see [isUnlimited]).
  final int limit;

  /// The backend's `-1` sentinel: no cap, so there is no bar to draw — only an
  /// honest "Unlimited". Distinct from a metered feature at zero usage.
  bool get isUnlimited => limit < 0;

  /// A real cap the teacher can run down: the only case that draws a bar.
  bool get isMetered => limit > 0;

  /// How full the meter is, clamped to `[0, 1]`. Zero for unlimited (or a
  /// degenerate zero limit) so a caller never divides by zero or overshoots the
  /// track when `used > limit`.
  double get fraction {
    if (limit <= 0) return 0;
    return (used / limit).clamp(0.0, 1.0).toDouble();
  }
}

/// The teacher's usage + capability summary for the current month.
///
/// Mirrors the `GET /api/usage` body EXACTLY (verified against
/// `src/app/api/usage/route.ts`):
/// `{ plan, canExport, canViewDetailedAnalytics, canAccessAbsenceRecords,
///    canUseParentMessaging, model, usage }`, where `usage` is a
/// `feature -> { used, limit }` map. The capability booleans come straight from
/// `PLAN_CONFIG[plan]`, so they are the same flags the server enforces.
class UsageSummary {
  const UsageSummary({
    required this.plan,
    required this.canExport,
    required this.canViewDetailedAnalytics,
    required this.canAccessAbsenceRecords,
    required this.canUseParentMessaging,
    required this.model,
    required this.features,
  });

  /// The server-authoritative plan (the normalized `x-user-plan`). Reuses
  /// [PlanBadge.fromClaim] so the tier label here cannot disagree with the
  /// identity badge, which reads the same tiers from the token claim.
  final PlanBadge plan;

  final bool canExport;
  final bool canViewDetailedAnalytics;
  final bool canAccessAbsenceRecords;
  final bool canUseParentMessaging;

  /// The Gemini model this plan runs on (informational).
  final String model;

  /// Every metered/unlimited feature, metered ones first (they carry the bars a
  /// teacher acts on), each group preserving the server's declaration order.
  final List<FeatureUsage> features;

  factory UsageSummary.fromJson(Map<String, dynamic> json) {
    final raw = json['usage'];
    // Preserve server order within each group; List.sort is not stable, so the
    // two groups are built separately and concatenated.
    final metered = <FeatureUsage>[];
    final unlimited = <FeatureUsage>[];
    if (raw is Map) {
      raw.forEach((key, value) {
        if (key is String && value is Map) {
          final entry = FeatureUsage(
            feature: key,
            used: _int(value['used']),
            // A missing/garbled limit is treated as unlimited rather than a
            // zero cap, so a decode slip never invents a "0 / 0" wall.
            limit: _int(value['limit'], fallback: -1),
          );
          (entry.isMetered ? metered : unlimited).add(entry);
        }
      });
    }

    return UsageSummary(
      plan: PlanBadge.fromClaim(json['plan']),
      canExport: json['canExport'] == true,
      canViewDetailedAnalytics: json['canViewDetailedAnalytics'] == true,
      canAccessAbsenceRecords: json['canAccessAbsenceRecords'] == true,
      canUseParentMessaging: json['canUseParentMessaging'] == true,
      model: json['model'] is String ? json['model'] as String : '',
      features: [...metered, ...unlimited],
    );
  }
}

/// Tolerant int parse: the counts are `number` server-side but arrive as `int`,
/// and a stray `num`/numeric-string must not throw inside a usage render.
int _int(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

/// Data-layer gateway for the read-only usage summary. Presentation watches
/// [usageSummaryProvider]; only this repository touches [ApiClient]. Errors
/// surface as the typed `ApiException` the client speaks — a 401 (today's
/// runtime state, because `tokenProvider` is the P0.2 stub) is the caller's cue
/// to degrade to the signed-out hub.
///
/// BUILT-PENDING-FIREBASE. `GET /api/usage` 401s until a real Firebase ID token
/// is attached (see [tokenProvider]); the UI and tests are driven from fixtures.
class UsageRepository {
  const UsageRepository(this._client);

  final ApiClient _client;

  static const String _usagePath = '/api/usage';

  Future<UsageSummary> fetchUsage() {
    return _client.get<UsageSummary>(
      _usagePath,
      decode: (json) => UsageSummary.fromJson(
        json is Map ? Map<String, dynamic>.from(json) : const <String, dynamic>{},
      ),
    );
  }
}

@riverpod
UsageRepository usageRepository(Ref ref) {
  return UsageRepository(ref.watch(apiClientProvider));
}

/// The current month's usage, for the Plan & usage section. A `FutureProvider`
/// so the hub gets loading / error / data for free; `ref.invalidate` behind the
/// section's retry re-runs the fetch.
@riverpod
Future<UsageSummary> usageSummary(Ref ref) {
  return ref.watch(usageRepositoryProvider).fetchUsage();
}
