import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/icon_well.dart';

/// The upsell a premium-gated attendance write renders **in place of its
/// form**.
///
/// WHY THIS IS NOT AN ERROR PANEL
///
/// `requireProPlan` fronts `createClass`, `addStudent` and `saveAttendance`,
/// and the repository returns that 403 as the VALUE
/// `AttendanceWriteBlockedByPlan` rather than throwing it (see
/// `domain/attendance_write_result.dart`). The server itself logs it at WARN
/// with the note that the client surfaces it as an upsell. Nothing went wrong
/// and the teacher did nothing wrong: the register they were reading a moment
/// ago is still readable, and only the write is gated. So this is an
/// accent-barred [AppCard] with a feature [IconWell] — the same grammar the
/// Parent Hotline's plan gate uses — and never an `InlineError` or an
/// `ErrorView`.
///
/// It carries no upgrade BUTTON on purpose: the app has no in-app purchase or
/// pricing route to send the teacher to, and a button that goes nowhere is
/// worse than a sentence that is true.
class AttendancePremiumCard extends StatelessWidget {
  const AttendancePremiumCard({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    return AppCard(
      accentBar: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const IconWell(icon: LucideIcons.sparkles, feature: true),
          const SizedBox(height: AppSpacing.space4),
          Text(l10n.attendancePremiumTitle, style: text.titleLarge),
          const SizedBox(height: AppSpacing.space2),
          Text(l10n.attendancePremiumBody, style: text.bodyMedium),
        ],
      ),
    );
  }
}
