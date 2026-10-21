import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../inbox/data/block_c_transport.dart';
import '../../data/staffroom_transport.dart';

/// The optimistic **join** control for a group header (SPEC §A3.3).
///
/// Tapping "Join" flips to the settled "Joined" indicator **immediately** and
/// calls `joinGroup`; on success it reconciles against the returned membership
/// flag, and on a [TransportUnavailable] / any typed error it **rolls back** to
/// "Join" with a quiet inline hint (on-device the deferred transport throws every
/// write, so the tap simply reverts — never a crash).
///
/// A one-way Join → Joined (leaving a group is U-SI4). [onJoinedChanged] fires
/// only from the tap handler (never during build) with the current membership so
/// a parent can optimistically bump its displayed member count.
class JoinButton extends ConsumerStatefulWidget {
  const JoinButton({
    super.key,
    required this.groupId,
    this.initialJoined = false,
    this.onJoinedChanged,
  });

  final String groupId;
  final bool initialJoined;
  final ValueChanged<bool>? onJoinedChanged;

  @override
  ConsumerState<JoinButton> createState() => _JoinButtonState();
}

class _JoinButtonState extends ConsumerState<JoinButton> {
  /// `null` → use `widget.initialJoined`; non-null → a local optimistic override.
  bool? _joined;
  bool _busy = false;
  bool _failed = false;

  bool get _isJoined => _joined ?? widget.initialJoined;

  Future<void> _join() async {
    if (_busy || _isJoined) return;
    setState(() {
      _busy = true;
      _failed = false;
      _joined = true; // optimistic
    });
    widget.onJoinedChanged?.call(true);
    try {
      final joined =
          await ref.read(staffroomTransportProvider).joinGroup(widget.groupId);
      if (!mounted) return;
      setState(() {
        _joined = joined;
        _busy = false;
      });
      widget.onJoinedChanged?.call(joined);
    } on TransportUnavailable {
      _rollback();
    } catch (_) {
      _rollback();
    }
  }

  void _rollback() {
    if (!mounted) return;
    setState(() {
      _joined = false;
      _busy = false;
      _failed = true;
    });
    widget.onJoinedChanged?.call(false);
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

    if (_isJoined) {
      // Settled, full-width "Joined" indicator: a check + label in the saffron
      // tint (saffron-text on primary@0.12 ≈ 5.14:1 AA). Not a button — leaving
      // is a later unit; this reads as "done", not "disabled".
      return Semantics(
        label: l10n.staffroomJoined,
        child: Container(
          width: double.infinity,
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: scheme.primary.withValues(alpha: 0.12),
            borderRadius: AppRadius.rControl,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.check, size: AppIconSize.inline, color: saffronText),
              const SizedBox(width: AppSpacing.space2),
              Text(
                l10n.staffroomJoined,
                style: text.labelLarge?.copyWith(
                  color: saffronText,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        PrimaryButton(
          label: l10n.staffroomJoin,
          isBusy: _busy,
          onPressed: _join,
        ),
        if (_failed) ...[
          const SizedBox(height: AppSpacing.space2),
          Text(
            l10n.staffroomJoinFailed,
            style: text.bodySmall?.copyWith(
              color: scheme.onSurfaceVariant,
              fontStyle: FontStyle.italic,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ],
    );
  }
}
