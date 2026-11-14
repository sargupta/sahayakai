import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/i18n/gen/app_localizations.dart';
import '../../../core/i18n/l10n_ext.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/inline_error.dart';
import '../../../shared/widgets/map_option.dart';
import '../../../shared/widgets/primary_button.dart';
import '../data/moderation_repository.dart';
import '../domain/moderation.dart';
import 'blocked_teachers_controller.dart';

// Report and block for what other teachers post (Google Play's user-generated
// content policy: users must be able to report content and block users from
// inside the app). Used by the community feed, the staff-room chat and
// direct messages.

/// The name to show for a teacher, or "this teacher" when it is unknown.
String moderationName(AppLocalizations l10n, String name) =>
    name.trim().isEmpty ? l10n.moderationUnnamedTeacher : name.trim();

/// Opens the report sheet for one post, message or profile. [title] names
/// what is reported ("Report post"); nothing is sent until the teacher picks
/// a reason and taps Send.
Future<void> showContentReportSheet(
  BuildContext context, {
  required ReportTarget target,
  required String targetId,
  required String title,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    elevation: 0,
    isScrollControlled: true,
    barrierColor: AppColors.ink900.withValues(alpha: 0.18),
    builder: (_) =>
        ContentReportSheet(target: target, targetId: targetId, title: title),
  );
}

/// Asks "Block {name}?" and, on yes, blocks them and says so. Returns true when
/// the teacher was blocked.
Future<bool> confirmAndBlockTeacher(
  BuildContext context,
  WidgetRef ref, {
  required String uid,
  required String name,
}) async {
  final l10n = context.l10n;
  final shown = moderationName(l10n, name);
  final messenger = ScaffoldMessenger.maybeOf(context);
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(l10n.moderationBlockConfirmTitle(shown)),
      content: Text(l10n.moderationBlockConfirmBody),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(l10n.actionCancel),
        ),
        TextButton(
          key: const ValueKey('moderation-block-confirm'),
          onPressed: () => Navigator.of(context).pop(true),
          style: TextButton.styleFrom(foregroundColor: AppColors.danger),
          child: Text(l10n.moderationBlockAction),
        ),
      ],
    ),
  );
  if (confirmed != true) return false;
  try {
    await ref.read(blockedTeachersProvider.notifier).block(uid, name.trim());
    messenger
      ?..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text(l10n.moderationBlockedSnack(shown))),
      );
    return true;
  } catch (_) {
    messenger
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(l10n.moderationBlockFailed)));
    return false;
  }
}

/// The "⋮" menu on another teacher's content: report it, or block them.
class ModerationMenuButton extends ConsumerWidget {
  const ModerationMenuButton({
    super.key,
    required this.reportLabel,
    required this.target,
    required this.targetId,
    required this.authorUid,
    required this.authorName,
    this.onBlocked,
  });

  /// "Report post" / "Report message" / "Report {name}".
  final String reportLabel;
  final ReportTarget target;
  final String targetId;
  final String authorUid;
  final String authorName;

  /// Called after the teacher was blocked (e.g. to leave a conversation).
  final VoidCallback? onBlocked;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    return PopupMenuButton<_ModerationChoice>(
      key: const ValueKey('moderation-menu'),
      tooltip: l10n.moderationMoreActions,
      icon: const Icon(LucideIcons.moreVertical, size: 18),
      color: AppColors.milk50,
      onSelected: (choice) async {
        switch (choice) {
          case _ModerationChoice.report:
            await showContentReportSheet(
              context,
              target: target,
              targetId: targetId,
              title: reportLabel,
            );
          case _ModerationChoice.block:
            final blocked = await confirmAndBlockTeacher(
              context,
              ref,
              uid: authorUid,
              name: authorName,
            );
            if (blocked) onBlocked?.call();
        }
      },
      itemBuilder: (context) => [
        PopupMenuItem(
          value: _ModerationChoice.report,
          child: _MenuRow(icon: LucideIcons.flag, label: reportLabel),
        ),
        PopupMenuItem(
          value: _ModerationChoice.block,
          child: _MenuRow(
            icon: LucideIcons.ban,
            label: l10n.moderationBlockTeacher(
              moderationName(l10n, authorName),
            ),
          ),
        ),
      ],
    );
  }
}

/// The same two actions as a sheet, for a long-press on a chat message.
Future<void> showMessageModerationSheet(
  BuildContext context,
  WidgetRef ref, {
  required String messageId,
  required String authorUid,
  required String authorName,
}) async {
  final l10n = context.l10n;
  final choice = await showModalBottomSheet<_ModerationChoice>(
    context: context,
    backgroundColor: AppColors.milk50,
    shape: const RoundedRectangleBorder(borderRadius: AppRadius.rSheet),
    builder: (context) => SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.space3),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              key: const ValueKey('moderation-report-message'),
              leading: const Icon(LucideIcons.flag),
              title: Text(l10n.moderationReportMessage),
              onTap: () => Navigator.of(context).pop(_ModerationChoice.report),
            ),
            ListTile(
              key: const ValueKey('moderation-block-author'),
              leading: const Icon(LucideIcons.ban, color: AppColors.danger),
              title: Text(
                l10n.moderationBlockTeacher(moderationName(l10n, authorName)),
              ),
              onTap: () => Navigator.of(context).pop(_ModerationChoice.block),
            ),
          ],
        ),
      ),
    ),
  );
  if (choice == null || !context.mounted) return;
  switch (choice) {
    case _ModerationChoice.report:
      await showContentReportSheet(
        context,
        target: ReportTarget.message,
        targetId: messageId,
        title: l10n.moderationReportMessage,
      );
    case _ModerationChoice.block:
      await confirmAndBlockTeacher(
        context,
        ref,
        uid: authorUid,
        name: authorName,
      );
  }
}

enum _ModerationChoice { report, block }

class _MenuRow extends StatelessWidget {
  const _MenuRow({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 18, color: AppColors.textBody),
      const SizedBox(width: AppSpacing.space2),
      Flexible(child: Text(label)),
    ],
  );
}

/// The report sheet: a reason, an optional note, Send.
class ContentReportSheet extends ConsumerStatefulWidget {
  const ContentReportSheet({
    super.key,
    required this.target,
    required this.targetId,
    required this.title,
  });

  final ReportTarget target;
  final String targetId;
  final String title;

  @override
  ConsumerState<ContentReportSheet> createState() => _ContentReportSheetState();
}

class _ContentReportSheetState extends ConsumerState<ContentReportSheet> {
  final TextEditingController _note = TextEditingController();
  ReportReason? _reason;
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final reason = _reason;
    if (reason == null || _sending) return;
    final l10n = context.l10n;
    final messenger = ScaffoldMessenger.maybeOf(context);
    final navigator = Navigator.of(context);
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref
          .read(moderationRepositoryProvider)
          .report(
            target: widget.target,
            targetId: widget.targetId,
            reason: reason,
            details: _note.text,
          );
      if (!mounted) return;
      navigator.pop();
      messenger
        ?..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.aiReportSent)));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = e.kind == ApiErrorKind.rateLimited
            ? l10n.moderationReportLimit
            : l10n.aiReportFailedBody;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = l10n.aiReportFailedBody;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final reasons = <(ReportReason, String)>[
      (ReportReason.harassment, l10n.moderationReasonHarassment),
      (ReportReason.inappropriate, l10n.moderationReasonInappropriate),
      (ReportReason.spam, l10n.moderationReasonSpam),
      (ReportReason.other, l10n.aiReportReasonOther),
    ];

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.9,
        ),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: AppColors.milk50,
            borderRadius: AppRadius.rSheet,
            boxShadow: [AppShadows.sheet],
          ),
          child: SafeArea(
            top: false,
            child: SingleChildScrollView(
              padding: AppSpacing.sheetPadding,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 44,
                      height: 4,
                      decoration: ShapeDecoration(
                        color: AppColors.ink900.withValues(alpha: 0.14),
                        shape: const StadiumBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space3),
                  Semantics(
                    header: true,
                    child: Text(
                      widget.title,
                      style: text.titleLarge?.copyWith(
                        color: AppColors.textStrong,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space1),
                  Text(
                    l10n.aiReportBody,
                    style: text.bodyMedium?.copyWith(color: AppColors.textBody),
                  ),
                  const SizedBox(height: AppSpacing.space4),
                  for (final (reason, label) in reasons) ...[
                    MapOption(
                      key: ValueKey('report-reason-${reason.wire}'),
                      label: label,
                      selected: _reason == reason,
                      showCheck: true,
                      onTap: () => setState(() => _reason = reason),
                    ),
                    const SizedBox(height: AppSpacing.space2),
                  ],
                  const SizedBox(height: AppSpacing.space2),
                  TextField(
                    controller: _note,
                    maxLines: 3,
                    minLines: 2,
                    maxLength: kReportDetailsMax,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      labelText: l10n.aiReportNoteLabel,
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: AppSpacing.space2),
                    InlineError(title: l10n.aiReportFailed, message: _error!),
                  ],
                  const SizedBox(height: AppSpacing.space3),
                  PrimaryButton(
                    key: const ValueKey('report-send'),
                    label: l10n.aiReportSend,
                    icon: LucideIcons.flag,
                    isBusy: _sending,
                    onPressed: _reason == null ? null : _send,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
