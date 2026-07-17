import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';

/// Dashboard home: greeting + a real (left-aligned) tool grid. The Lesson Plan
/// tile deep-links to its screen; the rest are non-navigating placeholders
/// until their units land.
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final l10n = context.l10n;

    final tools = <_Tool>[
      _Tool(
        l10n.lessonPlanTitle,
        l10n.lessonPlanSubtitle,
        LucideIcons.bookOpen,
        route: Routes.lessonPlan,
      ),
      _Tool(
        l10n.quizTitle,
        l10n.quizSubtitle,
        LucideIcons.clipboardList,
        route: Routes.quizGenerator,
      ),
      _Tool(
        l10n.instantAnswerTitle,
        l10n.instantAnswerSubtitle,
        LucideIcons.messageSquare,
        route: Routes.instantAnswer,
      ),
      const _Tool(
        'Worksheet',
        'Turn a photo into a worksheet',
        LucideIcons.penTool,
      ),
    ];

    return Scaffold(
      appBar: AppBar(title: Text(l10n.appTitle)),
      body: SafeArea(
        child: ListView(
          padding: AppSpacing.pagePadding,
          children: [
            Text(l10n.dashboardGreeting, style: text.headlineSmall),
            const SizedBox(height: AppSpacing.space6),
            Text(
              l10n.dashboardToolsTitle,
              style: text.titleSmall?.copyWith(
                color: scheme.onSurfaceVariant,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: AppSpacing.space3),
            for (final tool in tools) ...[
              AppCard(
                onTap: tool.route == null
                    ? null
                    : () => context.push(tool.route!),
                child: Row(
                  children: [
                    _ToolIconWrap(icon: tool.icon),
                    const SizedBox(width: AppSpacing.space4),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(tool.title, style: text.titleMedium),
                          const SizedBox(height: AppSpacing.space1),
                          Text(
                            tool.subtitle,
                            style: text.bodyMedium
                                ?.copyWith(color: scheme.onSurfaceVariant),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.space2),
                    Icon(
                      LucideIcons.chevronRight,
                      size: 20,
                      color: scheme.onSurfaceVariant,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.space3),
            ],
          ],
        ),
      ),
    );
  }
}

class _Tool {
  const _Tool(this.title, this.subtitle, this.icon, {this.route});
  final String title;
  final String subtitle;
  final IconData icon;
  final String? route;
}

/// 48x48 rounded-12 container, primary/10 fill, primary icon (web `tool-icon-wrap`).
class _ToolIconWrap extends StatelessWidget {
  const _ToolIconWrap({required this.icon});
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: scheme.primary.withValues(alpha: 0.1),
        borderRadius: AppRadius.rLg,
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: 20, color: scheme.primary),
    );
  }
}
