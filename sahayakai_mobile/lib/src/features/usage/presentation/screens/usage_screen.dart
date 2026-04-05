import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../data/usage_repository.dart';
import '../../domain/usage_models.dart';

class UsageScreen extends ConsumerWidget {
  const UsageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usageAsync = ref.watch(usageProvider);

    return GlassScaffold(
      title: 'Usage & Limits',
      showBackButton: true,
      body: usageAsync.when(
        loading: () => const Center(
          child: GlassLoadingIndicator(message: 'Loading usage...'),
        ),
        error: (_, __) => const GlassEmptyState(
          icon: Icons.error_outline_rounded,
          title: 'Could not load usage',
          message: 'Please try again later.',
        ),
        data: (usage) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(usageProvider);
          },
          child: _buildContent(context, usage),
        ),
      ),
    );
  }

  Widget _buildContent(BuildContext context, UsageResponse usage) {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(GlassSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Plan badge
          GlassCard(
            child: Row(
              children: [
                Icon(Icons.workspace_premium_rounded,
                    color: GlassColors.primary, size: 32),
                const SizedBox(width: GlassSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${usage.plan.toUpperCase()} Plan',
                        style: GlassTypography.headline3(),
                      ),
                      Text(
                        usage.model ?? '',
                        style: GlassTypography.bodySmall(
                            color: GlassColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                if (usage.plan == 'free')
                  GlassSecondaryButton(
                    label: 'Upgrade',
                    icon: Icons.arrow_upward_rounded,
                    onPressed: () => context.push('/pricing'),
                  ),
              ],
            ),
          ),
          const SizedBox(height: GlassSpacing.xxl),

          Text('FEATURE USAGE THIS MONTH',
              style: GlassTypography.sectionHeader()),
          const SizedBox(height: GlassSpacing.lg),

          ...usage.features.entries.map((entry) {
            return _buildUsageBar(entry.key, entry.value);
          }),
        ],
      ),
    );
  }

  Widget _buildUsageBar(String feature, FeatureUsage usage) {
    final label = _featureLabel(feature);

    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.lg),
      child: GlassCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(label, style: GlassTypography.labelLarge()),
                Text(usage.displayText,
                    style: GlassTypography.bodySmall(
                        color: GlassColors.textSecondary)),
              ],
            ),
            if (!usage.isUnlimited) ...[
              const SizedBox(height: GlassSpacing.sm),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: usage.usagePercent,
                  backgroundColor: GlassColors.border.withOpacity(0.3),
                  valueColor: AlwaysStoppedAnimation(
                    usage.usagePercent > 0.9
                        ? Colors.red
                        : GlassColors.primary,
                  ),
                  minHeight: 6,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _featureLabel(String key) {
    const labels = {
      'lesson-plan': 'Lesson Plans',
      'quiz': 'Quizzes',
      'worksheet': 'Worksheets',
      'rubric': 'Rubrics',
      'instant-answer': 'Instant Answers',
      'teacher-training': 'Teacher Training',
      'virtual-field-trip': 'Virtual Field Trips',
      'visual-aid': 'Visual Aids',
      'exam-paper': 'Exam Papers',
      'voice-to-text': 'Voice-to-Text',
    };
    return labels[key] ?? key;
  }
}
