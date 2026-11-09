import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/l10n_ext.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_view.dart';
import '../data/staffroom_providers.dart';
import '../domain/group.dart';
import 'community_errors.dart';
import 'widgets/post_composer.dart';

/// "Post to Community" from a tool's result: the Staffroom composer in a
/// sheet, opened on [text] as a Resource post to one of the teacher's groups.
///
/// Nothing is posted until the teacher taps Post — she can edit the draft,
/// change the type or the group, or close the sheet. A teacher with no group
/// yet is told to join one (every post belongs to a group).
Future<void> showShareToCommunitySheet(
  BuildContext context, {
  required String text,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    elevation: 0,
    isScrollControlled: true,
    barrierColor: AppColors.ink900.withValues(alpha: 0.18),
    builder: (_) => ShareToCommunitySheet(text: text),
  );
}

class ShareToCommunitySheet extends ConsumerWidget {
  const ShareToCommunitySheet({super.key, required this.text});

  /// The draft the composer opens on.
  final String text;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final textTheme = Theme.of(context).textTheme;
    final groups = ref.watch(myGroupsProvider);

    final Widget body = groups.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: AppSpacing.space6),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => ErrorView(
        message: communityErrorText(
          l10n,
          error,
          fallback: l10n.communityComposerFailed,
        ),
        onRetry: () => ref.invalidate(myGroupsProvider),
      ),
      data: (List<Group> mine) => mine.isEmpty
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.staffroomGroupsEmptyTitle,
                  style: textTheme.titleMedium?.copyWith(
                    color: AppColors.textStrong,
                  ),
                ),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  l10n.staffroomGroupsEmptyBody,
                  style: textTheme.bodyMedium?.copyWith(
                    color: AppColors.textBody,
                  ),
                ),
              ],
            )
          : PostComposer(
              groups: mine,
              initialText: text,
              initialType: PostType.resource,
              startOpen: true,
              onPosted: () => Navigator.of(context).maybePop(),
            ),
    );

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.86,
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
                      l10n.deliverPostCommunity,
                      style: textTheme.titleLarge?.copyWith(
                        color: AppColors.textStrong,
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.space3),
                  body,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
