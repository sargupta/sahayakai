import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/map_icon_tile.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../data/staffroom_providers.dart';
import '../../data/staffroom_transport.dart';
import '../community_errors.dart';

/// The optimistic **join** control for a group header.
///
/// Tapping "Join" flips to the settled "Joined" indicator **immediately** and
/// calls `POST /api/groups/{id}/membership`. The route is idempotent and
/// answers `{ joined }` — `false` only means "already a member" — so any
/// successful reply settles on "Joined". On success every read a membership
/// change affects is invalidated (the teacher's groups, suggestions, the feed,
/// this group's header and posts), so the posts unlock and the feed fills
/// without a manual refresh. On any error it **rolls back** to "Join" with a
/// translated inline reason.
///
/// One-way Join → Joined: leaving needs `DELETE .../membership`, which the
/// app's HTTP client does not expose yet. [onJoinedChanged] fires only from the
/// tap handler (never during build) with the current membership so a parent can
/// optimistically bump its displayed member count.
class JoinButton extends ConsumerStatefulWidget {
  const JoinButton({
    super.key,
    required this.groupId,
    this.initialJoined = false,
    this.onJoinedChanged,
    this.label,
  });

  final String groupId;
  final bool initialJoined;
  final ValueChanged<bool>? onJoinedChanged;

  /// The Join button's words; null is the short "Join".
  final String? label;

  @override
  ConsumerState<JoinButton> createState() => _JoinButtonState();
}

class _JoinButtonState extends ConsumerState<JoinButton> {
  /// `null` → use `widget.initialJoined`; non-null → a local optimistic override.
  bool? _joined;
  bool _busy = false;
  Object? _error;

  bool get _isJoined => _joined ?? widget.initialJoined;

  Future<void> _join() async {
    if (_busy || _isJoined) return;
    setState(() {
      _busy = true;
      _error = null;
      _joined = true; // optimistic
    });
    widget.onJoinedChanged?.call(true);
    try {
      final newlyJoined = await ref
          .read(staffroomTransportProvider)
          .joinGroup(widget.groupId);
      if (!mounted) return;
      // `joined: false` = "already a member" (idempotent) — still a member.
      setState(() {
        _joined = true;
        _busy = false;
      });
      if (!newlyJoined) widget.onJoinedChanged?.call(false);
      invalidateAfterMembershipChange(ref, widget.groupId);
    } catch (error) {
      _rollback(error);
    }
  }

  void _rollback(Object error) {
    if (!mounted) return;
    setState(() {
      _joined = false;
      _busy = false;
      _error = error;
    });
    widget.onJoinedChanged?.call(false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;

    if (_isJoined) {
      // Settled "Joined ✓": a leaf-tint pill (the map's `.btn.gon`), its words
      // and a check, never colour alone. Not a button — leaving is a later
      // unit; this reads as "done", not "disabled".
      return Semantics(
        label: l10n.staffroomJoined,
        excludeSemantics: true,
        child: Container(
          width: double.infinity,
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.space3,
            vertical: AppSpacing.space2,
          ),
          alignment: Alignment.center,
          decoration: ShapeDecoration(
            color: MapTint.leaf.fill,
            shape: const StadiumBorder(),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Flexible(
                child: Text(
                  l10n.staffroomJoined,
                  textAlign: TextAlign.center,
                  style: text.labelLarge?.copyWith(
                    color: MapTint.leaf.ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.space2),
              Icon(
                LucideIcons.check,
                size: AppIconSize.inline,
                color: MapTint.leaf.ink,
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
          label: widget.label ?? l10n.staffroomJoin,
          icon: LucideIcons.userPlus,
          isBusy: _busy,
          onPressed: _join,
        ),
        if (_error != null) ...[
          const SizedBox(height: AppSpacing.space2),
          Text(
            communityErrorText(
              l10n,
              _error,
              fallback: l10n.staffroomJoinFailed,
            ),
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
