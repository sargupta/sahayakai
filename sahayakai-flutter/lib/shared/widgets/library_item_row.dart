import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/i18n/gen/app_localizations.dart';
import '../../core/i18n/l10n_ext.dart';
import '../../core/theme/app_theme.dart';
import '../domain/library_item.dart';
import 'app_card.dart';
import 'icon_well.dart';

/// One saved generation, as both the dashboard's Recent section and the Library
/// screen render it. Shared so the same item cannot read two different ways on
/// two tabs.
///
/// TAPPABLE when [onTap] is supplied — both surfaces now open the item's detail
/// (`LibraryDetailScreen`), which reads the full document off the wired
/// `GET /api/content/get?id=<id>`. When [onTap] is null (e.g. a document with no
/// id, which cannot be fetched) the row still renders, just without the tap
/// affordance — an absent affordance is better than one that opens nothing.
class LibraryItemRow extends StatelessWidget {
  const LibraryItemRow({super.key, required this.item, this.onTap});

  final LibraryItem item;

  /// Opens the item. Null makes the row inert (no InkWell, no chevron).
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;

    // A document with no title still belongs to the teacher and still renders.
    final title = item.title.isNotEmpty ? item.title : l10n.dashboardUntitled;

    final meta = <String>[
      typeLabel(l10n, item.type),
      if (item.gradeLevel != null) item.gradeLevel!,
      if (item.subject != null) item.subject!,
      if (item.createdAt != null)
        // MaterialLocalizations, not `intl`'s DateFormat: the delegates are
        // already loaded for all 11 locales, so this needs no
        // `initializeDateFormatting` call and cannot throw on a locale whose
        // date symbols were never initialized.
        MaterialLocalizations.of(context).formatMediumDate(item.createdAt!),
    ].join(' · ');

    return AppCard(
      // The whole card is the target, so it is far past 48dp.
      onTap: onTap,
      child: Row(
        children: [
          IconWell(icon: item.type.icon),
          const SizedBox(width: AppSpacing.space4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(title, style: text.titleMedium),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  meta,
                  style: text.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          // The chevron signals the row opens — shown only when it actually can.
          if (onTap != null) ...[
            const SizedBox(width: AppSpacing.space2),
            Icon(
              LucideIcons.chevronRight,
              size: AppIconSize.inline,
              color: scheme.onSurfaceVariant,
            ),
          ],
        ],
      ),
    );
  }
}

/// Exhaustive on purpose: a new [ContentType] will not compile until it has
/// copy, which is what keeps `unknown` from quietly becoming the label for a
/// type someone forgot to name.
String typeLabel(AppLocalizations l10n, ContentType type) {
  return switch (type) {
    ContentType.lessonPlan => l10n.contentTypeLessonPlan,
    ContentType.quiz => l10n.contentTypeQuiz,
    ContentType.worksheet => l10n.contentTypeWorksheet,
    ContentType.visualAid => l10n.contentTypeVisualAid,
    ContentType.rubric => l10n.contentTypeRubric,
    ContentType.microLesson => l10n.contentTypeMicroLesson,
    ContentType.virtualFieldTrip => l10n.contentTypeVirtualFieldTrip,
    ContentType.instantAnswer => l10n.contentTypeInstantAnswer,
    ContentType.teacherTraining => l10n.contentTypeTeacherTraining,
    ContentType.examPaper => l10n.contentTypeExamPaper,
    ContentType.assessment => l10n.contentTypeAssessment,
    ContentType.unknown => l10n.contentTypeUnknown,
  };
}
