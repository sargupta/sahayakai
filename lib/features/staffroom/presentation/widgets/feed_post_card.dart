import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/platform/link_opener.dart';
import '../../../../core/platform/share_service.dart';
import '../../../../core/router/routes.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/ai_text.dart';
import '../../../../shared/widgets/map_card.dart';
import '../../../../shared/widgets/map_icon_tile.dart';
import '../../../inbox/data/block_c_transport.dart';
import '../../../inbox/presentation/inbox_time.dart';
import '../../../moderation/domain/moderation.dart';
import '../../../moderation/presentation/blocked_teachers_controller.dart';
import '../../../moderation/presentation/moderation_actions.dart';
import '../../data/staffroom_providers.dart';
import '../../data/staffroom_transport.dart';
import '../../domain/chat_quote.dart';
import '../../domain/daily_briefing.dart';
import '../../domain/group.dart';
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

  /// Posts longer than this open folded behind "Read more".
  static const int _foldAt = 320;

  bool _expanded = false;

  bool get _isLong => widget.post.content.length > _foldAt;

  /// The first lines of a long post, cut at a word and marked with an ellipsis.
  static String _folded(String content) {
    final cut = content.lastIndexOf(RegExp(r'\s'), _foldAt - 40);
    final end = cut > _foldAt ~/ 2 ? cut : _foldAt - 40;
    return '${content.substring(0, end).trimRight()}…';
  }

  /// Shares the post as "Author: text" through the OS sheet; if the sheet
  /// cannot open, the text is copied instead and the teacher is told.
  Future<void> _share() async {
    final post = widget.post;
    final text = post.authorName.trim().isEmpty
        ? post.content
        : '${post.authorName.trim()}: ${post.content}';
    try {
      await ref.read(shareServiceProvider).shareText(text);
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: text));
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(context.l10n.resultShareFailed)));
    }
  }

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
    // A Daily Briefing reads as a digest of its stories; null for any other
    // post (or a briefing whose text does not have the server's shape).
    final briefing = parseDailyBriefing(post.content);

    final group = widget.groupName?.trim() ?? '';
    final timestamp = inboxRelativeTime(post.createdAt, DateTime.now(), l10n);

    return MapCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // The kind as a tinted strip across the top (icon + words, never
          // colour alone), with the group it was posted in.
          _KindStrip(type: post.postType, group: group),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    StaffroomAvatar(
                      name: post.authorName,
                      photoUrl: post.authorPhotoURL,
                      size: 40,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            post.authorName,
                            style: text.titleLarge?.copyWith(
                              fontSize: 15,
                              color: AppColors.textStrong,
                            ),
                          ),
                          if (timestamp.isNotEmpty)
                            Text(
                              timestamp,
                              style: text.bodyMedium?.copyWith(
                                fontSize: AppText.metaSize,
                                color: AppColors.textMuted,
                              ),
                            ),
                        ],
                      ),
                    ),
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
                const SizedBox(height: 10),
                // Body: server-authored prose (full ink, matra-safe). A Daily
                // Briefing opens as a short digest: the lead story, the other
                // headlines, "Read all N". Any other long post opens folded,
                // with "Read more"; short posts show whole.
                if (briefing != null && !_expanded)
                  _BriefingDigest(briefing: briefing)
                else if (_isLong && !_expanded)
                  AiText(_folded(post.content))
                else
                  AiText(post.content),
                if (briefing != null || _isLong)
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: TextButton(
                      key: ValueKey('post-more-${post.id}'),
                      onPressed: () => setState(() => _expanded = !_expanded),
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: const Size(0, 40),
                        foregroundColor: AppColors.textLink,
                      ),
                      child: Text(
                        _expanded
                            ? l10n.staffroomShowLess
                            : briefing != null
                            ? '${l10n.staffroomBriefingReadAll(briefing.headlines.length)} ›'
                            : l10n.staffroomReadMore,
                        style: text.labelLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.textLink,
                        ),
                      ),
                    ),
                  )
                else
                  const SizedBox(height: 4),
                // What the post shares (a worksheet, a link): one row each. A
                // folded briefing keeps them back until "Read all".
                if (post.attachments.isNotEmpty &&
                    (briefing == null || _expanded))
                  _PostAttachments(attachments: post.attachments),
              ],
            ),
          ),
          // Footer: Like, Reply (Help out on a request for help) and Share.
          // The server keeps no comments, so Reply opens the group's chat
          // with the post quoted instead of a dead comment icon.
          Padding(
            padding: const EdgeInsets.fromLTRB(6, 0, 6, 6),
            child: Row(
              children: [
                _LikeButton(liked: _isLiked, count: _likeCount, onTap: _toggle),
                // Reply and Share shrink and wrap their words before the row
                // overflows (a long Tamil "Help out" at large text).
                if (post.groupId.isNotEmpty)
                  Flexible(
                    child: _ReplyButton(
                      key: ValueKey('post-reply-${post.id}'),
                      helpOut: post.postType == PostType.askHelp,
                      onTap: _reply,
                    ),
                  ),
                const SizedBox(width: 4),
                Expanded(
                  child: Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: TextButton.icon(
                      key: ValueKey('post-share-${post.id}'),
                      onPressed: _share,
                      style: TextButton.styleFrom(
                        minimumSize: const Size(44, 44),
                        foregroundColor: AppColors.textBody,
                      ),
                      icon: const Icon(
                        LucideIcons.share2,
                        size: AppIconSize.small,
                      ),
                      label: Text(l10n.actionShare),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (_failed)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
              child: Align(
                alignment: AlignmentDirectional.centerEnd,
                child: Text(
                  l10n.staffroomLikeFailed,
                  style: text.bodySmall?.copyWith(
                    color: scheme.onSurfaceVariant,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Opens the post's group chat with the composer holding a quote of it.
  void _reply() {
    final post = widget.post;
    context.push(
      Routes.groupChatPath(post.groupId),
      extra: ChatRouteArgs(
        title: widget.groupName,
        quote: ChatQuote(author: post.authorName, text: post.content),
      ),
    );
  }
}

/// A post's attachments, one row each: a tinted icon, the title and, for a
/// link, its site. A row opens only an absolute http(s) link with a host —
/// attachment URLs come from other teachers, so nothing else (javascript:,
/// file:, relative) is ever handed to the OS.
class _PostAttachments extends ConsumerWidget {
  const _PostAttachments({required this.attachments});

  final List<PostAttachment> attachments;

  static Uri? _safe(String? raw) {
    final uri = raw == null ? null : Uri.tryParse(raw.trim());
    if (uri == null || uri.host.isEmpty) return null;
    return uri.scheme == 'https' || uri.scheme == 'http' ? uri : null;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final rows = [
      for (final a in attachments)
        if ((a.title ?? '').trim().isNotEmpty || _safe(a.url) != null) a,
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final a in rows)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.space2),
            child: Builder(
              builder: (context) {
                final url = _safe(a.url);
                final isLink = a.type == 'link' || a.resourceId == null;
                final title = (a.title ?? '').trim().isNotEmpty
                    ? a.title!.trim()
                    : url!.host;
                return Semantics(
                  button: url != null,
                  label: title,
                  excludeSemantics: true,
                  child: Material(
                    color: AppColors.surfaceMapCard,
                    shape: const RoundedRectangleBorder(
                      borderRadius: AppRadius.rRow,
                      side: BorderSide(color: AppColors.borderHairline),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: url == null
                          ? null
                          : () => ref.read(linkOpenerProvider).open(url),
                      child: Padding(
                        padding: const EdgeInsets.all(10),
                        child: Row(
                          children: [
                            MapIconTile(
                              icon: isLink
                                  ? LucideIcons.link
                                  : LucideIcons.fileText,
                              tint: isLink ? MapTint.indigo : MapTint.leaf,
                            ),
                            const SizedBox(width: AppSpacing.space3),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    title,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: text.bodyLarge?.copyWith(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textStrong,
                                    ),
                                  ),
                                  if (url != null)
                                    Text(
                                      url.host.replaceFirst('www.', ''),
                                      style: text.bodySmall?.copyWith(
                                        color: AppColors.textMuted,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            if (url != null)
                              const Icon(
                                LucideIcons.externalLink,
                                size: 16,
                                color: AppColors.textMuted,
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}

/// The Daily Briefing, folded to a digest: the lead headline, then the other
/// headlines on one quiet "Also:" line. "Read all N" (in the card) unfolds the
/// whole briefing, summaries and sources included.
class _BriefingDigest extends StatelessWidget {
  const _BriefingDigest({required this.briefing});

  final DailyBriefing briefing;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final rest = briefing.headlines.skip(1).toList(growable: false);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          briefing.headlines.first,
          style: text.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: AppColors.textStrong,
            height: 1.35,
          ),
        ),
        if (rest.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.space1),
          Text(
            l10n.staffroomBriefingAlso(rest.join(' · ')),
            // A preview of the other stories: two lines at most; "Read all"
            // shows every one of them in full.
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: text.bodyMedium?.copyWith(color: AppColors.textMuted),
          ),
        ],
      ],
    );
  }
}

/// The post's kind across the top of the card: its icon and line ("Tried
/// this in class") in the kind's tint, and the group on the right.
class _KindStrip extends StatelessWidget {
  const _KindStrip({required this.type, required this.group});

  final PostType type;
  final String group;

  @override
  Widget build(BuildContext context) {
    final tint = postTypeTint(type);
    final style = Theme.of(context).textTheme.labelLarge?.copyWith(
      fontSize: 12.5,
      fontWeight: FontWeight.w700,
      color: tint.ink,
    );
    return ColoredBox(
      color: tint.fill,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        child: Row(
          children: [
            Icon(postTypeIcon(type), size: 15, color: tint.ink),
            const SizedBox(width: 8),
            Expanded(
              child: Text(postKindLine(context.l10n, type), style: style),
            ),
            if (group.isNotEmpty) ...[
              const SizedBox(width: 8),
              Flexible(
                child: Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: Text(
                    group,
                    textAlign: TextAlign.end,
                    style: style?.copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Reply: opens the group chat with the post quoted. On a request for help it
/// is a tinted "Help out" pill, so the ask stands out.
class _ReplyButton extends StatelessWidget {
  const _ReplyButton({super.key, required this.helpOut, required this.onTap});

  final bool helpOut;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final text = Theme.of(context).textTheme;
    final label = helpOut ? l10n.cmPostHelpOut : l10n.cmPostReply;
    final ink = helpOut ? AppColors.tileIndigoInk : AppColors.textBody;
    return Semantics(
      button: true,
      label: label,
      hint: l10n.cmPostReplyHint,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.rPill,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 44, minWidth: 44),
          child: Center(
            widthFactor: 1,
            child: Container(
              padding: EdgeInsets.symmetric(
                horizontal: helpOut ? 14 : 8,
                vertical: 7,
              ),
              decoration: helpOut
                  ? const ShapeDecoration(
                      color: AppColors.tileIndigoBg,
                      shape: StadiumBorder(),
                    )
                  : null,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.cornerUpLeft, size: 16, color: ink),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      label,
                      style: text.labelLarge?.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: ink,
                      ),
                    ),
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
        borderRadius: AppRadius.rRow,
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
                child: Icon(
                  LucideIcons.heart,
                  size: AppIconSize.micro,
                  color: ink,
                ),
              ),
              const SizedBox(width: 2),
              Text(
                '$count',
                style: text.bodySmall?.copyWith(
                  fontSize: AppText.metaSize,
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
