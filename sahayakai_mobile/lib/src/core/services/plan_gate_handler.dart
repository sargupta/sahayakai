import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Handles 403 (plan upgrade needed) and 429 (limit reached) API responses.
///
/// Call [handleApiError] in catch blocks to show appropriate user messages.
class PlanGateHandler {
  PlanGateHandler._();

  /// Check if a DioException is a plan-gating error and show appropriate UI.
  /// Returns true if the error was handled (403/429), false otherwise.
  static bool handleApiError(BuildContext context, Object error) {
    if (error is! DioException || error.response == null) return false;

    final status = error.response!.statusCode;
    final data = error.response!.data;

    if (status == 403) {
      // Feature not available on user's plan.
      final requiredPlan = data is Map ? data['requiredPlan'] ?? 'Pro' : 'Pro';
      _showUpgradeDialog(context, requiredPlan.toString());
      return true;
    }

    if (status == 429) {
      // Monthly/daily limit reached.
      final limit = data is Map ? data['limit'] : null;
      final used = data is Map ? data['used'] : null;
      _showLimitDialog(context, limit, used);
      return true;
    }

    return false;
  }

  static void _showUpgradeDialog(BuildContext context, String requiredPlan) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Upgrade Required'),
        content: Text(
          'This feature requires the $requiredPlan plan. '
          'Upgrade to unlock all AI-powered tools for your classroom.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Later'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.push('/pricing');
            },
            child: const Text('View Plans'),
          ),
        ],
      ),
    );
  }

  static void _showLimitDialog(
      BuildContext context, dynamic limit, dynamic used) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Limit Reached'),
        content: Text(
          limit != null
              ? 'You\'ve used $used of $limit allowed this month. '
                'Upgrade your plan for higher limits.'
              : 'You\'ve reached your usage limit for this feature. '
                'Please try again later or upgrade your plan.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('OK'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.push('/pricing');
            },
            child: const Text('Upgrade'),
          ),
        ],
      ),
    );
  }
}
