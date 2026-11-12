import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/theme/app_theme.dart';
import '../data/ai_report_repository.dart';
import 'inline_error.dart';
import 'map_option.dart';
import 'primary_button.dart';

/// Opens the "Report this AI content" sheet for [content] (a VIDYA reply or a
/// tool's result). [feature] names where it came from, for the reviewers.
///
/// Google Play requires apps that generate content with AI to let users
/// report offensive output to the developer without leaving the app; this is
/// that path. Nothing is sent until the teacher picks a reason and taps Send.
Future<void> showAiReportSheet(
  BuildContext context, {
  required String content,
  required String feature,
}) {
  final page = GoRouter.maybeOf(context)?.state.uri.path ?? '';
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    elevation: 0,
    isScrollControlled: true,
    barrierColor: AppColors.ink900.withValues(alpha: 0.18),
    builder: (_) =>
        AiReportSheet(content: content, feature: feature, page: page),
  );
}

class AiReportSheet extends ConsumerStatefulWidget {
  const AiReportSheet({
    super.key,
    required this.content,
    required this.feature,
    this.page = '',
  });

  final String content;
  final String feature;
  final String page;

  @override
  ConsumerState<AiReportSheet> createState() => _AiReportSheetState();
}

class _AiReportSheetState extends ConsumerState<AiReportSheet> {
  final TextEditingController _note = TextEditingController();
  AiReportReason? _reason;
  bool _sending = false;
  bool _failed = false;

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
      _failed = false;
    });
    try {
      await ref
          .read(aiReportRepositoryProvider)
          .report(
            feature: widget.feature,
            page: widget.page,
            reason: reason,
            content: widget.content,
            note: _note.text,
          );
      if (!mounted) return;
      navigator.pop();
      messenger
        ?..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(l10n.aiReportSent)));
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _failed = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final reasons = <(AiReportReason, String)>[
      (AiReportReason.offensive, l10n.aiReportReasonOffensive),
      (AiReportReason.wrong, l10n.aiReportReasonWrong),
      (AiReportReason.unsuitable, l10n.aiReportReasonUnsuitable),
      (AiReportReason.other, l10n.aiReportReasonOther),
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
                      l10n.aiReportTitle,
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
                    maxLength: 500,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: InputDecoration(
                      labelText: l10n.aiReportNoteLabel,
                    ),
                  ),
                  if (_failed) ...[
                    const SizedBox(height: AppSpacing.space2),
                    InlineError(
                      title: l10n.aiReportFailed,
                      message: l10n.aiReportFailedBody,
                    ),
                  ],
                  const SizedBox(height: AppSpacing.space3),
                  PrimaryButton(
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
