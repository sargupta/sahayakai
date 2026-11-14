import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_skeleton.dart';
import '../../../shared/widgets/glass_app_bar.dart';
import '../../../shared/widgets/map_card.dart';
import '../../staffroom/presentation/widgets/staffroom_avatar.dart';
import '../domain/moderation.dart';
import 'blocked_teachers_controller.dart';
import 'moderation_actions.dart';

/// Settings → Blocked teachers: everyone the teacher has blocked, each with
/// Unblock.
class BlockedTeachersScreen extends ConsumerWidget {
  const BlockedTeachersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final async = ref.watch(blockedTeachersProvider);
    return Scaffold(
      appBar: GlassAppBar(title: Text(l10n.moderationBlockedTitle)),
      body: SafeArea(
        child: switch (async) {
          AsyncData(:final value) when value.isEmpty => ListView(
            padding: AppSpacing.pagePadding,
            children: [
              MapCard(
                child: MapEmptyNote(
                  icon: LucideIcons.ban,
                  message: l10n.moderationBlockedEmpty,
                ),
              ),
            ],
          ),
          AsyncData(:final value) => ListView.separated(
            padding: AppSpacing.pagePadding,
            itemCount: value.length,
            separatorBuilder: (_, _) =>
                const SizedBox(height: AppSpacing.space3),
            itemBuilder: (context, i) => _BlockedRow(teacher: value[i]),
          ),
          _ => const Padding(
            padding: AppSpacing.pagePadding,
            child: AppSkeleton(lines: 3),
          ),
        },
      ),
    );
  }
}

class _BlockedRow extends ConsumerStatefulWidget {
  const _BlockedRow({required this.teacher});

  final BlockedTeacher teacher;

  @override
  ConsumerState<_BlockedRow> createState() => _BlockedRowState();
}

class _BlockedRowState extends ConsumerState<_BlockedRow> {
  bool _busy = false;

  Future<void> _unblock() async {
    if (_busy) return;
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.maybeOf(context);
    final name = moderationName(l10n, widget.teacher.name);
    setState(() => _busy = true);
    try {
      await ref
          .read(blockedTeachersProvider.notifier)
          .unblock(widget.teacher.uid);
      messenger
        ?..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text(l10n.moderationUnblockedSnack(name))),
        );
    } catch (_) {
      if (mounted) setState(() => _busy = false);
      messenger
        ?..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.moderationUnblockFailed)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final name = moderationName(l10n, widget.teacher.name);
    return MapCard(
      padding: const EdgeInsetsDirectional.fromSTEB(14, 10, 8, 10),
      child: Row(
        children: [
          StaffroomAvatar(
            name: name,
            photoUrl: widget.teacher.photoUrl,
            size: 40,
          ),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Text(
              name,
              style: text.bodyLarge?.copyWith(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.textStrong,
              ),
            ),
          ),
          TextButton(
            key: ValueKey('unblock-${widget.teacher.uid}'),
            onPressed: _busy ? null : _unblock,
            child: Text(l10n.moderationUnblock),
          ),
        ],
      ),
    );
  }
}
