import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/map_card.dart';
import '../../../inbox/data/block_c_transport.dart';
import '../../../inbox/presentation/inbox_time.dart';
import '../../../moderation/domain/moderation.dart';
import '../../../moderation/presentation/blocked_teachers_controller.dart';
import '../../../moderation/presentation/moderation_actions.dart';
import '../../data/staffroom_providers.dart';
import '../../data/staffroom_transport.dart';
import '../../domain/group.dart';
import 'connection_action.dart';
import 'post_type_style.dart';
import 'staffroom_avatar.dart';

/// A group-post card (SPEC §A3.3 / §A3.4) — the unified feed's primary grammar
/// and the group detail's post row, in one `MapCard(flat)`:
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
    final post = widget.post;
    final myUid = ref.watch(currentStaffroomUserIdProvider);
    // A blocked teacher's post disappears at once (the server also filters
    // the next feed read).
    final blocked = ref.watch(
      blockedUidsProvider.select((uids) => uids.contains(post.authorUid)),
    );
    if (blocked) return const SizedBox.shrink();
    final othersPost = post.authorUid.isNotEmpty && post.authorUid != myUid;

    final group = widget.groupName?.trim() ?? '';
    final timestamp = inboxRelativeTime(post.createdAt, DateTime.now(), l10n);
    final meta = [
      if (group.isNotEmpty) group,
      if (timestamp.isNotEmpty) timestamp,
    ].join(' · ');

    return MapCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Masthead (UX map post): avatar, the author over "group · time",
          // and the post type as a tinted pill.
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              StaffroomAvatar(
                name: post.authorName,
                photoUrl: post.authorPhotoURL,
                size: 36,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      post.authorName,
                      style: text.bodyLarge?.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.textStrong,
                      ),
                    ),
                    if (meta.isNotEmpty)
                      Text(
                        meta,
                        style: text.bodyMedium?.copyWith(
                          color: AppColors.textMuted,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.space2),
              _TypePill(type: post.postType),
              if (othersPost)
                ModerationMenuButton(
                  reportLabel: l10n.moderationReportPost,
                  target: ReportTarget.post,
                  targetId: post.id,
                  authorUid: post.authorUid,
                  authorName: post.authorName,
                ),
            ],
          ),
          const SizedBox(height: 9),
          // Body: server-authored prose (full ink, matra-safe).
          AiText(post.content),
          const SizedBox(height: 2),
          // Footer, as in the map: the like, the comment count when there is
          // one, and Connect on another teacher's post.
          Row(
            children: [
              _LikeButton(liked: _isLiked, count: _likeCount, onTap: _toggle),
              // The comment count takes the free width, so Connect sits flush
              // right; with no comments a spacer does the same.
              if (post.commentsCount > 0) ...[
                const SizedBox(width: AppSpacing.space3),
                Expanded(
                  child: Text(
                    l10n.staffroomCommentsCount(post.commentsCount),
                    style: text.bodySmall?.copyWith(
                      fontSize: 12.5,
                      color: AppColors.textMuted,
                    ),
                  ),
                ),
              ] else
                const Spacer(),
              if (othersPost)
                TeacherConnectionAction(
                  uid: post.authorUid,
                  displayName: post.authorName,
                  photoURL: post.authorPhotoURL,
                  compact: true,
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
}

/// The post type as the map's pill: tinted, bold, small caps in Latin script.
class _TypePill extends StatelessWidget {
  const _TypePill({required this.type});

  final PostType type;

  @override
  Widget build(BuildContext context) {
    final tint = postTypeTint(type);
    final latin = Localizations.localeOf(context).languageCode == 'en';
    final label = postTypeLabel(context.l10n, type);
    return Container(
      height: 24,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: ShapeDecoration(
        color: tint.fill,
        shape: const StadiumBorder(),
      ),
      child: Center(
        widthFactor: 1,
        child: Text(
          latin ? label.toUpperCase() : label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            fontSize: latin ? 10.5 : 12,
            fontWeight: FontWeight.w700,
            letterSpacing: latin ? 0.6 : 0,
            color: tint.ink,
          ),
        ),
      ),
    );
  }
}

/// The like affordance, as in the map: a heart and the count, compact.
///
/// **Liked** = a red heart on a soft red disc; **not liked** = the muted
/// outline heart with no disc. The disc is a shape difference, so the state is
/// not colour-only, and `Semantics(toggled:)` announces on/off with a distinct
/// "Liked"/"Like" label. The touch target is 44dp tall.
class _LikeButton extends StatelessWidget {
  const _LikeButton({
    required this.liked,
    required this.count,
    required this.onTap,
  });

  final bool liked;
  final int count;
  final VoidCallback onTap;

  static const double _disc = 28;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final ink = liked ? AppColors.red500 : AppColors.textMuted;

    return Semantics(
      button: true,
      toggled: liked,
      label: liked ? l10n.staffroomLiked : l10n.staffroomLike,
      value: l10n.staffroomLikeCountLabel(count),
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.rControl,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: _disc,
                height: _disc,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: liked ? AppColors.mapRequiredBg : null,
                ),
                child: Icon(LucideIcons.heart, size: 15, color: ink),
              ),
              const SizedBox(width: 2),
              Text(
                '$count',
                style: text.bodySmall?.copyWith(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  fontFeatures: const [FontFeature.tabularFigures()],
                  color: liked ? AppColors.red700 : AppColors.textBody,
                ),
              ),
              const SizedBox(width: AppSpacing.space1),
            ],
          ),
        ),
      ),
    );
  }
}
