import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../../shared/widgets/icon_well.dart';
import '../../domain/community_post.dart';
import '../../domain/group.dart';
import '../../domain/staffroom_results.dart';
import '../../domain/teacher.dart';
import 'feed_post_card.dart';
import 'teacher_suggestion_card.dart';

/// The polymorphic unified-feed item (SPEC §A3.4). One card per [FeedItem],
/// switching on [FeedItem.type]:
///   - `group_post`            → [FeedPostCard] (the optimistic-like grammar);
///   - `resource_share`        → a resource card;
///   - `connection_suggestion` → a [TeacherSuggestionCard] (reused via an adapter);
///   - `group_suggestion`      → a tappable group card → group detail;
///   - `chat_highlight`        → a staff-room teaser → group detail.
///
/// A degenerate item (e.g. a `group_post` with a null payload, which the DTO
/// decoder already guards) renders nothing rather than crashing the feed.
class FeedItemView extends StatelessWidget {
  const FeedItemView({
    super.key,
    required this.item,
    required this.likedIds,
  });

  final FeedItem item;
  final LikedItemIds likedIds;

  @override
  Widget build(BuildContext context) {
    switch (item.type) {
      case FeedItemType.groupPost:
        final post = item.post;
        if (post == null) return const SizedBox.shrink();
        return FeedPostCard(
          post: post,
          initialLiked: likedIds.likedPost(post.id),
          groupName: item.groupName,
        );
      case FeedItemType.connectionSuggestion:
        final s = item.connectionSuggestion;
        if (s == null) return const SizedBox.shrink();
        return TeacherSuggestionCard(
          teacher: TeacherSuggestion(
            uid: s.uid,
            displayName: s.displayName,
            photoURL: s.photoURL,
            subjects: s.sharedSubjects,
            recommendationReason: s.reason,
          ),
        );
      case FeedItemType.resourceShare:
        final r = item.resource;
        if (r == null) return const SizedBox.shrink();
        return _ResourceCard(resource: r);
      case FeedItemType.groupSuggestion:
        final g = item.groupSuggestion;
        if (g == null) return const SizedBox.shrink();
        return _FeedGroupCard(group: g);
      case FeedItemType.chatHighlight:
        final c = item.chatHighlight;
        if (c == null) return const SizedBox.shrink();
        return _ChatHighlightCard(highlight: c);
    }
  }
}

/// A shared-resource feed card: a doc-type overline, the title, the author, and
/// the like count (display-only — resource likes are a separate action).
class _ResourceCard extends StatelessWidget {
  const _ResourceCard({required this.resource});

  final FeedResource resource;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    final extras = AppTextExtras.of(context);
    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const IconWell(icon: LucideIcons.fileText),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(l10n.staffroomResourceShared, style: extras.overline),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  resource.title,
                  style: text.titleSmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.space2),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        resource.authorName,
                        style: text.bodyMedium
                            ?.copyWith(color: scheme.onSurfaceVariant),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    AppBadge(
                      label: '${resource.likes}',
                      icon: LucideIcons.heart,
                      size: AppBadgeSize.small,
                      tone: AppBadgeTone.accent,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A group-suggestion feed card: a tappable full-width group row → group detail.
class _FeedGroupCard extends StatelessWidget {
  const _FeedGroupCard({required this.group});

  final Group group;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    final extras = AppTextExtras.of(context);
    return AppCard(
      onTap: () => context.push(Routes.groupDetailPath(group.id)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const IconWell(icon: LucideIcons.users),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  group.name,
                  style: text.titleSmall,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  l10n.staffroomMemberCount(group.memberCount),
                  style:
                      extras.dataMedium.copyWith(color: scheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.space2),
          Icon(
            LucideIcons.chevronRight,
            size: AppIconSize.inline,
            color: scheme.onSurfaceVariant,
          ),
        ],
      ),
    );
  }
}

/// A staff-room chat-highlight feed card → group detail.
class _ChatHighlightCard extends StatelessWidget {
  const _ChatHighlightCard({required this.highlight});

  final FeedChatHighlight highlight;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final text = theme.textTheme;
    final extras = AppTextExtras.of(context);
    final latest = highlight.latestMessage?.trim();
    return AppCard(
      onTap: () => context.push(Routes.groupDetailPath(highlight.groupId)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const IconWell(icon: LucideIcons.messagesSquare),
          const SizedBox(width: AppSpacing.space3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  highlight.groupName,
                  style: text.titleSmall,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.space1),
                Text(
                  l10n.staffroomChatHighlight(highlight.messageCount),
                  style: extras.overline,
                ),
                if (latest != null && latest.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.space2),
                  AiText(latest, muted: true),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
