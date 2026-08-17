import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../../inbox/data/block_c_transport.dart';
import '../../data/staffroom_transport.dart';
import '../../domain/connection.dart';
import '../../domain/teacher.dart';
import 'staffroom_avatar.dart';

/// A "People you may know" card (SPEC §A3.1): the teacher's avatar + name +
/// school, a saffron `recommendationReason` badge, and an optimistic **Connect**
/// action that calls `sendConnectionRequest` and branches the toast on the
/// returned status (sent / already_pending / already_connected), exactly like the
/// web handler. On success it settles to a "Requested" state.
///
/// This card is only ever shown inside the Staffroom's **ready** state (a
/// non-null uid), which on-device never occurs (the deferred reads + null uid
/// render the sign-in surface instead) — so Connect is never a confusing
/// on-device no-op. The full connection lifecycle (accept / decline / the DM
/// gate) is U-SI4.
class TeacherSuggestionCard extends ConsumerStatefulWidget {
  const TeacherSuggestionCard({super.key, required this.teacher});

  final TeacherSuggestion teacher;

  @override
  ConsumerState<TeacherSuggestionCard> createState() =>
      _TeacherSuggestionCardState();
}

class _TeacherSuggestionCardState extends ConsumerState<TeacherSuggestionCard> {
  bool _requested = false;
  bool _busy = false;

  Future<void> _connect() async {
    if (_busy || _requested) return;
    setState(() => _busy = true);
    try {
      final result = await ref
          .read(staffroomTransportProvider)
          .sendConnectionRequest(widget.teacher.uid);
      if (!mounted) return;
      setState(() {
        _requested = true;
        _busy = false;
      });
      final l10n = context.l10n;
      final msg = switch (result) {
        ConnectionRequestResult.sent => l10n.staffroomConnectSent,
        ConnectionRequestResult.alreadyPending => l10n.staffroomConnectPending,
        ConnectionRequestResult.alreadyConnected =>
          l10n.staffroomConnectConnected,
      };
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(msg)));
    } on TransportUnavailable {
      // Firebase-gated: quietly stay as "Connect" (no misleading toast).
      if (mounted) setState(() => _busy = false);
    } catch (_) {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    final saffronText = theme.brightness == Brightness.dark
        ? AppColors.dPrimaryText
        : AppColors.lPrimaryText;
    final teacher = widget.teacher;
    final reason = teacher.recommendationReason?.trim();

    return AppCard(
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
                    Text(
                      teacher.displayName,
                      style: text.titleSmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (teacher.schoolName != null &&
                        teacher.schoolName!.trim().isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.space1),
                      Text(
                        teacher.schoolName!.trim(),
                        style: text.bodyMedium?.copyWith(
                          color: scheme.onSurfaceVariant,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    if (reason != null && reason.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.space2),
                      // The saffron accent draws attention to WHY recommended;
                      // the accent label is the AA-fixed saffron-text #AC4815
                      // (~5.14:1 on the primary@0.12 tint).
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
          const SizedBox(height: AppSpacing.space3),
          if (_requested)
            Semantics(
              label: l10n.staffroomConnectSent,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    LucideIcons.check,
                    size: AppIconSize.inline,
                    color: saffronText,
                  ),
                  const SizedBox(width: AppSpacing.space2),
                  Text(
                    l10n.staffroomConnectSent,
                    style: text.labelLarge?.copyWith(
                      color: saffronText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            )
          else
            SecondaryButton(
              label: l10n.staffroomConnect,
              icon: LucideIcons.userPlus,
              isBusy: _busy,
              onPressed: _connect,
            ),
        ],
      ),
    );
  }
}
