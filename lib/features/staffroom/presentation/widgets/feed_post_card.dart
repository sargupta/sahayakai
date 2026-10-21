import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/app_badge.dart';
import '../../../../shared/widgets/app_card.dart';
import '../../../inbox/data/block_c_transport.dart';
import '../../../inbox/presentation/inbox_time.dart';
import '../../data/staffroom_transport.dart';
import '../../domain/group.dart';
import 'staffroom_avatar.dart';

/// A group-post card (SPEC §A3.3 / §A3.4) — the unified feed's primary grammar
/// and the group detail's post row, in one `AppCard(flat)`:
///
///   masthead: [StaffroomAvatar] · author `titleSmall` · a saffron post-type
///     overline (`Lightbulb` share / `HelpCircle` ask_help / `Trophy` celebrate
///     / `FileUp` resource) + a compact relative timestamp;
///   body:     the server-authored `content` via [AiText] (matra-safe, full ink);
///   footer:   an optional neutral group chip + the **optimistic like** control.
///
/// ## Optimistic like (the payoff)
/// Tapping the heart toggles the filled/outline state and increments/decrements
/// the count **immediately**, then calls `likeGroupPost`. On success it reconciles
/// the heart + count against the authoritative [LikeResult]; on a
/// [TransportUnavailable] / any typed error it **rolls the toggle + count back**
/// and shows a quiet inline hint (never a crash — on-device the deferred
/// transport throws every write, so the tap just reverts).
///
/// The optimistic values are stored as **nullable overrides** (`null` → use the
/// widget's props). That means a card that has not been tapped automatically
/// adopts a fresh `initialLiked` when `likedItemIdsProvider` resolves after the
/// feed (the hearts fill in with no `didUpdateWidget`), while a card mid-toggle
/// keeps its own optimistic value.
class FeedPostCard extends ConsumerStatefulWidget {
  const FeedPostCard({
    super.key,
    required this.post,
    this.initialLiked = false,
    this.groupName,
  });

  final GroupPost post;

  /// Whether the current user has already liked this post
  /// (`likedItemIds.likedPost(post.id)`), used to seed the filled heart.
  final bool initialLiked;

  /// The owning group's name → the neutral footer chip. Null hides the chip
  /// (e.g. inside a group detail, where the group is already the screen).
  final String? groupName;

  @override
  ConsumerState<FeedPostCard> createState() => _FeedPostCardState();
}

class _FeedPostCardState extends ConsumerState<FeedPostCard> {
  /// `null` → use `widget.initialLiked` (so a late `likedItemIds` resolve is
  /// adopted for an untouched card); non-null → a local optimistic override.
  bool? _liked;
  int? _count;
  bool _busy = false;
  bool _failed = false;

  bool get _isLiked => _liked ?? widget.initialLiked;
  int get _likeCount => _count ?? widget.post.likesCount;

  Future<void> _toggle() async {
    if (_busy) return;
    final wasLiked = _isLiked;
    final wasCount = _likeCount;
    final nextLiked = !wasLiked;
    final optimisticCount = wasCount + (nextLiked ? 1 : -1);
    setState(() {
      _busy = true;
      _failed = false;
      _liked = nextLiked;
      _count = optimisticCount < 0 ? 0 : optimisticCount;
    });
    try {
      final result = await ref
          .read(staffroomTransportProvider)
          .likeGroupPost(widget.post.groupId, widget.post.id);
      if (!mounted) return;
      // Reconcile against the authoritative server reply.
      setState(() {
        _liked = result.isLiked;
        _count = result.newCount;
        _busy = false;
      });
    } on TransportUnavailable {
      _rollback(wasLiked, wasCount);
    } catch (_) {
      _rollback(wasLiked, wasCount);
    }
  }

  void _rollback(bool wasLiked, int wasCount) {
    if (!mounted) return;
    setState(() {
      _liked = wasLiked;
      _count = wasCount;
      _busy = false;
      _failed = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final text = theme.textTheme;
    final extras = AppTextExtras.of(context);
    final saffronText = theme.brightness == Brightness.dark
        ? AppColors.dPrimaryText
        : AppColors.lPrimaryText;
    final post = widget.post;

    final (icon: typeIcon, label: typeLabel) = _postType(l10n, post.postType);
    final timestamp = inboxRelativeTime(post.createdAt, DateTime.now(), l10n);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Masthead: avatar + author + post-type overline · timestamp.
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              StaffroomAvatar(
                name: post.authorName,
                photoUrl: post.authorPhotoURL,
                size: 40,
              ),
              const SizedBox(width: AppSpacing.space3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      post.authorName,
                      style: text.titleSmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.space1),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Icon(
                          typeIcon,
                          size: AppIconSize.inline,
                          // saffron-TEXT token (AA on the white card), never the
                          // #E0924D fill routed as an icon.
                          color: saffronText,
                        ),
                        const SizedBox(width: AppSpacing.space1),
                        Flexible(
                          child: Text(
                            typeLabel,
                            style: extras.overline,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (timestamp.isNotEmpty) ...[
                          const SizedBox(width: AppSpacing.space2),
                          Text(
                            timestamp,
                            style: extras.dataMedium
                                .copyWith(color: scheme.onSurfaceVariant),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.space3),
          // Body: server-authored prose (full ink, matra-safe).
          AiText(post.content),
          const SizedBox(height: AppSpacing.space3),
          // Footer: group chip + optimistic like.
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (widget.groupName != null &&
                  widget.groupName!.trim().isNotEmpty)
                Flexible(
                  child: AppBadge(
                    label: widget.groupName!.trim(),
                    icon: LucideIcons.users,
                    size: AppBadgeSize.small,
                  ),
                ),
              const Spacer(),
              _LikeButton(
                liked: _isLiked,
                count: _likeCount,
                onTap: _toggle,
              ),
            ],
          ),
          if (_failed) ...[
            const SizedBox(height: AppSpacing.space1),
            Align(
              alignment: Alignment.centerRight,
              child: Text(
                l10n.staffroomLikeFailed,
                style: text.bodySmall?.copyWith(
                  color: scheme.onSurfaceVariant,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  ({IconData icon, String label}) _postType(
    AppLocalizations l10n,
    PostType type,
  ) {
    switch (type) {
      case PostType.share:
        return (icon: LucideIcons.lightbulb, label: l10n.staffroomPostTypeShare);
      case PostType.askHelp:
        return (
          icon: LucideIcons.helpCircle,
          label: l10n.staffroomPostTypeAskHelp
        );
      case PostType.celebrate:
        return (icon: LucideIcons.trophy, label: l10n.staffroomPostTypeCelebrate);
      case PostType.resource:
        return (icon: LucideIcons.fileUp, label: l10n.staffroomPostTypeResource);
    }
  }
}

/// The like affordance: a heart + a tabular count in a ≥48dp tap target.
///
/// **Liked** = the outline heart in the saffron-text token inside a tinted
/// `primary@0.12` circle (a genuine FILL treatment: the tinted disc is a shape
/// difference the outline state lacks — Lucide ships no solid heart, so the disc
/// carries the "filled" read). **Not liked** = the bare outline heart in
/// `onSurfaceVariant`. The state is therefore **not colour-only**: the disc
/// appears/disappears, and `Semantics(toggled:)` announces on/off with a
/// distinct "Liked"/"Like" label.
///
/// WCAG AA on the white flat card: the saffron-text heart on the `primary@0.12`
/// disc is ~5.14:1 (matches `AppBadge.accent`); the muted outline heart on white
/// is 4.70:1 (clears the 3:1 non-text floor comfortably); the count is full-ink
/// `onSurface` (~16:1).
class _LikeButton extends StatelessWidget {
  const _LikeButton({
    required this.liked,
    required this.count,
    required this.onTap,
  });

  final bool liked;
  final int count;
  final VoidCallback onTap;

  static const double _disc = 32;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final extras = AppTextExtras.of(context);
    final saffronText = theme.brightness == Brightness.dark
        ? AppColors.dPrimaryText
        : AppColors.lPrimaryText;

    final heart = Container(
      width: _disc,
      height: _disc,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: liked ? scheme.primary.withValues(alpha: 0.12) : null,
      ),
      child: Icon(
        LucideIcons.heart,
        size: AppIconSize.inline,
        color: liked ? saffronText : scheme.onSurfaceVariant,
      ),
    );

    return Semantics(
      button: true,
      toggled: liked,
      label: liked ? l10n.staffroomLiked : l10n.staffroomLike,
      value: l10n.staffroomLikeCountLabel(count),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.rControl,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.space2,
                vertical: AppSpacing.space2,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  heart,
                  const SizedBox(width: AppSpacing.space1),
                  Text(
                    '$count',
                    style: extras.dataMedium.copyWith(color: scheme.onSurface),
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
