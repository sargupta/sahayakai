import 'package:flutter/material.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/map_card.dart';
import '../../domain/teacher.dart';
import '../community_errors.dart';
import 'connection_action.dart';
import 'staffroom_avatar.dart';

/// A "People you may know" card: the teacher's avatar + name + school, the
/// translated reason they were suggested, and the shared
/// [TeacherConnectionAction] (Connect → Requested, Accept/Decline for a request
/// they sent, Message once connected). The connection state comes from
/// `connectionsControllerProvider`, so it agrees with every other surface.
class TeacherSuggestionCard extends StatelessWidget {
  const TeacherSuggestionCard({super.key, required this.teacher});

  final TeacherSuggestion teacher;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    final reason = communityReasonLabel(l10n, teacher.recommendationReason);
    final school = teacher.schoolName?.trim();

    return MapCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              StaffroomAvatar(
                name: teacher.displayName,
                photoUrl: teacher.photoURL,
                size: 40,
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Names and schools wrap rather than ellipsize: a clipped
                    // name is exactly the detail a teacher needs to recognise
                    // a colleague.
                    Text(teacher.displayName, style: text.titleSmall),
                    if (school != null && school.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.space1),
                      Text(
                        school,
                        style: text.bodyMedium?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                    if (reason != null) ...[
                      const SizedBox(height: AppSpacing.space2),
                      // The saffron accent draws attention to WHY recommended;
                      // the accent label is the AA-fixed saffron-text token.
                      AppBadge(
                        label: reason,
                        tone: AppBadgeTone.accent,
                        size: AppBadgeSize.small,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space2),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TeacherConnectionAction(
              uid: teacher.uid,
              displayName: teacher.displayName,
              photoURL: teacher.photoURL,
            ),
          ),
        ],
      ),
    );
  }
}
