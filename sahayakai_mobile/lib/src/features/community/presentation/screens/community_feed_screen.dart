import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/services/metrics_service.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';
import '../../../../core/theme/glassmorphic/glass_skeleton.dart';
import '../../data/community_repository.dart';
import '../../domain/community_models.dart';

/// Riverpod provider that fetches community feed posts.
final feedPostsProvider = FutureProvider<List<CommunityPost>>((ref) {
  final repo = ref.read(communityRepositoryProvider);
  return repo.getFeedPosts();
});

/// Main community screen with four tabs: Feed, Groups, Library, Connections.
class CommunityFeedScreen extends ConsumerStatefulWidget {
  const CommunityFeedScreen({super.key});

  @override
  ConsumerState<CommunityFeedScreen> createState() =>
      _CommunityFeedScreenState();
}

class _CommunityFeedScreenState extends ConsumerState<CommunityFeedScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  /// Local copy of posts so we can do optimistic like-toggles without
  /// re-fetching the entire list from the provider.
  List<CommunityPost>? _posts;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    MetricsService.trackScreenView('community_feed');
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  String _timeAgo(DateTime dateTime) {
    final diff = DateTime.now().difference(dateTime);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    if (diff.inDays < 30) return '${(diff.inDays / 7).floor()}w ago';
    return '${(diff.inDays / 30).floor()}mo ago';
  }

  String _postTypeLabel(PostType type) {
    switch (type) {
      case PostType.share:
        return 'Share';
      case PostType.askHelp:
        return 'Ask Help';
      case PostType.celebrate:
        return 'Celebrate';
      case PostType.discussion:
        return 'Discussion';
      case PostType.resource:
        return 'Resource';
      case PostType.question:
        return 'Question';
      case PostType.announcement:
        return 'Announcement';
      case PostType.tip:
        return 'Tip';
    }
  }

  Color _postTypeColor(PostType type) {
    switch (type) {
      case PostType.share:
        return const Color(0xFF6366F1);
      case PostType.askHelp:
        return const Color(0xFFEC4899);
      case PostType.celebrate:
        return const Color(0xFF14B8A6);
      case PostType.discussion:
        return const Color(0xFF3B82F6);
      case PostType.resource:
        return const Color(0xFF10B981);
      case PostType.question:
        return const Color(0xFFF59E0B);
      case PostType.announcement:
        return const Color(0xFFEF4444);
      case PostType.tip:
        return const Color(0xFF8B5CF6);
    }
  }

  void _onToggleLike(CommunityPost post) {
    final repo = ref.read(communityRepositoryProvider);

    // Optimistic update
    setState(() {
      if (post.isLikedByMe) {
        post.isLikedByMe = false;
        post.likeCount = (post.likeCount - 1).clamp(0, 999999);
      } else {
        post.isLikedByMe = true;
        post.likeCount += 1;
      }
    });

    // Fire-and-forget network call; revert on failure could be added later.
    repo.toggleLikePost(post.id);
  }

  // ── Build ────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return GlassScaffold(
      title: 'Community',
      showBackButton: false,
      customAppBar: PreferredSize(
        preferredSize: const Size.fromHeight(kToolbarHeight + 48),
        child: Container(
          decoration: const BoxDecoration(
            gradient: GlassColors.warmBackgroundGradient,
          ),
          child: SafeArea(
            bottom: false,
            child: Column(
              children: [
                // Title row
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: GlassSpacing.lg,
                    vertical: GlassSpacing.sm,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Community',
                          style: GlassTypography.headline2(),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ),
                ),
                // Tab bar
                TabBar(
                  controller: _tabController,
                  labelColor: GlassColors.primary,
                  unselectedLabelColor: GlassColors.textTertiary,
                  indicatorColor: GlassColors.primary,
                  indicatorWeight: 2.5,
                  labelStyle: GlassTypography.labelMedium(),
                  unselectedLabelStyle: GlassTypography.labelMedium(),
                  tabs: const [
                    Tab(text: 'Feed'),
                    Tab(text: 'Groups'),
                    Tab(text: 'Library'),
                    Tab(text: 'Connections'),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildFeedTab(),
          _buildPlaceholderTab('Groups coming soon'),
          _buildPlaceholderTab('Community Library coming soon'),
          _buildPlaceholderTab('Connections coming soon'),
        ],
      ),
      floatingActionButton: GlassFloatingButton(
        label: 'New Post',
        icon: Icons.add_rounded,
        onPressed: () {
          Navigator.of(context).pushNamed('/community/compose');
        },
      ),
    );
  }

  // ── Feed tab ─────────────────────────────────────────────────────────

  Widget _buildFeedTab() {
    final asyncPosts = ref.watch(feedPostsProvider);

    return asyncPosts.when(
      loading: () => Padding(
        padding: const EdgeInsets.all(GlassSpacing.xl),
        child: GlassSkeletonList(
          itemCount: 4,
          itemHeight: 180,
          padding: EdgeInsets.zero,
        ),
      ),
      error: (error, _) => GlassEmptyState(
        icon: Icons.error_outline_rounded,
        title: 'Something went wrong',
        message: 'Could not load the feed. Pull down to try again.',
      ),
      data: (posts) {
        // Cache locally for optimistic updates
        _posts ??= List.of(posts);
        final displayPosts = _posts!;

        if (displayPosts.isEmpty) {
          return GlassEmptyState(
            icon: Icons.forum_outlined,
            title: 'No posts yet',
            message:
                'Be the first to share something with the community!',
          );
        }

        return RefreshIndicator(
          color: GlassColors.primary,
          onRefresh: () async {
            // Invalidate the provider so it re-fetches
            ref.invalidate(feedPostsProvider);
            // Wait for the new data
            final fresh =
                await ref.read(feedPostsProvider.future);
            setState(() {
              _posts = List.of(fresh);
            });
          },
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(
              horizontal: GlassSpacing.xl,
              vertical: GlassSpacing.lg,
            ),
            itemCount: displayPosts.length,
            itemBuilder: (context, index) =>
                _buildPostCard(displayPosts[index]),
          ),
        );
      },
    );
  }

  // ── Post card ────────────────────────────────────────────────────────

  Widget _buildPostCard(CommunityPost post) {
    final typeColor = _postTypeColor(post.postType);

    return Padding(
      padding: const EdgeInsets.only(bottom: GlassSpacing.lg),
      child: GlassCard(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Author header ──────────────────────────────────────
            Padding(
              padding: const EdgeInsets.all(GlassSpacing.lg),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor:
                        GlassColors.primary.withOpacity(0.1),
                    backgroundImage: post.authorAvatarUrl.isNotEmpty
                        ? NetworkImage(post.authorAvatarUrl)
                        : null,
                    child: post.authorAvatarUrl.isEmpty
                        ? Text(
                            post.authorName.isNotEmpty
                                ? post.authorName[0]
                                : '?',
                            style: GlassTypography.headline3(
                              color: GlassColors.primary,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: GlassSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                post.authorName,
                                style: GlassTypography.labelLarge(),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (post.authorRole.isNotEmpty) ...[
                              const SizedBox(width: GlassSpacing.sm),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: GlassSpacing.sm,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: GlassColors.primary
                                      .withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(
                                      GlassRadius.pill),
                                ),
                                child: Text(
                                  post.authorRole,
                                  style: GlassTypography.labelSmall(
                                    color: GlassColors.primary,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          post.createdAt != null
                              ? _timeAgo(DateTime.parse(post.createdAt!))
                              : '',
                          style: GlassTypography.bodySmall(),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.more_horiz_rounded,
                    color: GlassColors.textTertiary,
                  ),
                ],
              ),
            ),

            const Divider(height: 1, color: GlassColors.divider),

            // ── Content ────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.all(GlassSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    post.content,
                    style: GlassTypography.bodyMedium(
                      color: GlassColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: GlassSpacing.md),
                  // Post type chip + tags
                  Wrap(
                    spacing: GlassSpacing.sm,
                    runSpacing: GlassSpacing.sm,
                    children: [
                      // Type chip
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: GlassSpacing.md,
                          vertical: GlassSpacing.xs,
                        ),
                        decoration: BoxDecoration(
                          color: typeColor.withOpacity(0.1),
                          borderRadius:
                              BorderRadius.circular(GlassRadius.pill),
                        ),
                        child: Text(
                          _postTypeLabel(post.postType),
                          style: GlassTypography.labelSmall(
                              color: typeColor),
                        ),
                      ),
                      // Tag chips
                      ...post.tags.map(
                        (tag) => Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: GlassSpacing.md,
                            vertical: GlassSpacing.xs,
                          ),
                          decoration: BoxDecoration(
                            color: GlassColors.inputBackground,
                            borderRadius:
                                BorderRadius.circular(GlassRadius.pill),
                          ),
                          child: Text(
                            '#$tag',
                            style: GlassTypography.labelSmall(),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const Divider(height: 1, color: GlassColors.divider),

            // ── Action bar ─────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: GlassSpacing.lg,
                vertical: GlassSpacing.md,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  // Like button
                  GestureDetector(
                    onTap: () => _onToggleLike(post),
                    child: Row(
                      children: [
                        Icon(
                          post.isLikedByMe
                              ? Icons.favorite_rounded
                              : Icons.favorite_border_rounded,
                          size: 20,
                          color: post.isLikedByMe
                              ? const Color(0xFFEC4899)
                              : const Color(0xFFEC4899),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '${post.likeCount}',
                          style: GlassTypography.labelSmall(
                            color: const Color(0xFFEC4899),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Comment count
                  Row(
                    children: [
                      const Icon(
                        Icons.chat_bubble_outline_rounded,
                        size: 20,
                        color: Color(0xFF3B82F6),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${post.commentCount}',
                        style: GlassTypography.labelSmall(
                          color: const Color(0xFF3B82F6),
                        ),
                      ),
                    ],
                  ),
                  // Share button
                  GestureDetector(
                    onTap: () {},
                    child: Row(
                      children: [
                        const Icon(
                          Icons.share_rounded,
                          size: 20,
                          color: GlassColors.textSecondary,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'Share',
                          style: GlassTypography.labelSmall(
                            color: GlassColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Placeholder tabs ─────────────────────────────────────────────────

  Widget _buildPlaceholderTab(String message) {
    return Center(
      child: Text(
        message,
        style: GlassTypography.bodyMedium(
          color: GlassColors.textTertiary,
        ),
      ),
    );
  }
}
