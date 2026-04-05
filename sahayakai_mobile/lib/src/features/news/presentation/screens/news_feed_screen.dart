import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/theme/glassmorphic/glass_components.dart';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

final newsProvider = FutureProvider.family<List<Map<String, dynamic>>, String?>(
  (ref, category) async {
    final client = ref.read(apiClientProvider).client;
    final response = await client.get(
      '/news',
      queryParameters: {if (category != null) 'category': category},
    );
    return (response.data as List).cast<Map<String, dynamic>>();
  },
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const _categories = <String>[
  'All',
  'Policy',
  'Pedagogy',
  'Technology',
  'Board Updates',
  'NEP 2020',
];

const _categoryColors = <String, Color>{
  'Policy': Color(0xFF3B82F6), // blue
  'Pedagogy': Color(0xFF10B981), // green
  'Technology': Color(0xFF8B5CF6), // purple
  'Board Updates': Color(0xFFF97316), // orange
  'NEP 2020': Color(0xFFEF4444), // red
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class NewsFeedScreen extends ConsumerStatefulWidget {
  const NewsFeedScreen({super.key});

  @override
  ConsumerState<NewsFeedScreen> createState() => _NewsFeedScreenState();
}

class _NewsFeedScreenState extends ConsumerState<NewsFeedScreen> {
  String _selectedCategory = 'All';
  final Set<String> _bookmarkedIds = {};

  String? get _queryCategory =>
      _selectedCategory == 'All' ? null : _selectedCategory;

  Future<void> _refresh() async {
    // Invalidate current provider to trigger re-fetch.
    ref.invalidate(newsProvider(_queryCategory));
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _toggleBookmark(String id) {
    setState(() {
      if (_bookmarkedIds.contains(id)) {
        _bookmarkedIds.remove(id);
      } else {
        _bookmarkedIds.add(id);
      }
    });
  }

  // -----------------------------------------------------------------------
  // Build
  // -----------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final asyncNews = ref.watch(newsProvider(_queryCategory));

    return GlassScaffold(
      title: 'Edu News',
      body: Column(
        children: [
          _buildCategoryChips(),
          const SizedBox(height: GlassSpacing.sm),
          Expanded(
            child: asyncNews.when(
              data: (articles) => _buildArticleList(articles),
              loading: _buildShimmerLoading,
              error: (error, _) => _buildErrorState(error),
            ),
          ),
        ],
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Category filter chips
  // -----------------------------------------------------------------------

  Widget _buildCategoryChips() {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: GlassSpacing.lg),
        itemCount: _categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: GlassSpacing.sm),
        itemBuilder: (context, index) {
          final cat = _categories[index];
          final isSelected = cat == _selectedCategory;

          return FilterChip(
            selected: isSelected,
            label: Text(
              cat,
              style: GlassTypography.labelMedium(
                color: isSelected ? Colors.white : GlassColors.textSecondary,
              ),
            ),
            selectedColor: GlassColors.primary,
            backgroundColor: GlassColors.chipUnselected,
            side: BorderSide(
              color: isSelected ? GlassColors.primary : GlassColors.chipBorder,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: GlassRadius.chipRadius,
            ),
            showCheckmark: false,
            onSelected: (_) {
              setState(() => _selectedCategory = cat);
            },
          );
        },
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Article list
  // -----------------------------------------------------------------------

  Widget _buildArticleList(List<Map<String, dynamic>> articles) {
    if (articles.isEmpty) {
      return _buildEmptyState();
    }

    return RefreshIndicator(
      color: GlassColors.primary,
      onRefresh: _refresh,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(
          horizontal: GlassSpacing.lg,
          vertical: GlassSpacing.md,
        ),
        itemCount: articles.length,
        separatorBuilder: (_, __) => const SizedBox(height: GlassSpacing.md),
        itemBuilder: (context, index) =>
            _buildArticleCard(articles[index]),
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Article card
  // -----------------------------------------------------------------------

  Widget _buildArticleCard(Map<String, dynamic> article) {
    final id = article['id']?.toString() ?? '';
    final title = article['title'] as String? ?? '';
    final summary = article['summary'] as String? ?? '';
    final sourceUrl = article['sourceUrl'] as String? ?? '';
    final sourceName = article['sourceName'] as String? ?? '';
    final category = article['category'] as String? ?? '';
    final publishedAt = article['publishedAt'] as String? ?? '';
    final isBookmarked = _bookmarkedIds.contains(id);

    final badgeColor = _categoryColors[category] ?? GlassColors.textSecondary;

    return GlassCard(
      padding: GlassSpacing.cardPadding,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Category badge
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: GlassSpacing.sm,
              vertical: GlassSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: badgeColor.withOpacity(0.12),
              borderRadius: GlassRadius.chipRadius,
            ),
            child: Text(
              category.toUpperCase(),
              style: GlassTypography.labelSmall(color: badgeColor),
            ),
          ),
          const SizedBox(height: GlassSpacing.md),

          // Headline
          Text(
            title,
            style: GlassTypography.headline3(),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: GlassSpacing.sm),

          // AI-generated summary
          Text(
            summary,
            style: GlassTypography.bodyMedium(
              color: GlassColors.textSecondary,
            ),
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: GlassSpacing.md),

          // Source + date row
          Row(
            children: [
              Icon(
                Icons.source_outlined,
                size: 14,
                color: GlassColors.textTertiary,
              ),
              const SizedBox(width: GlassSpacing.xs),
              Expanded(
                child: Text(
                  '$sourceName  ·  ${_formatDate(publishedAt)}',
                  style: GlassTypography.bodySmall(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: GlassSpacing.md),

          // Actions row
          Row(
            children: [
              // Read More
              GestureDetector(
                onTap: sourceUrl.isNotEmpty ? () => _openUrl(sourceUrl) : null,
                child: Text(
                  'Read More',
                  style: GlassTypography.labelLarge(
                    color: GlassColors.primary,
                  ),
                ),
              ),
              const Spacer(),

              // Bookmark
              GestureDetector(
                onTap: () => _toggleBookmark(id),
                child: Icon(
                  isBookmarked ? Icons.bookmark : Icons.bookmark_border,
                  color: isBookmarked
                      ? GlassColors.primary
                      : GlassColors.textTertiary,
                  size: 22,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Shimmer skeleton loading
  // -----------------------------------------------------------------------

  Widget _buildShimmerLoading() {
    return ListView.separated(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(
        horizontal: GlassSpacing.lg,
        vertical: GlassSpacing.md,
      ),
      itemCount: 4,
      separatorBuilder: (_, __) => const SizedBox(height: GlassSpacing.md),
      itemBuilder: (_, __) => _ShimmerCard(),
    );
  }

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: GlassSpacing.screenPadding,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.newspaper_outlined,
              size: 64,
              color: GlassColors.textTertiary,
            ),
            const SizedBox(height: GlassSpacing.lg),
            Text(
              'No news articles found',
              style: GlassTypography.headline3(
                color: GlassColors.textSecondary,
              ),
            ),
            const SizedBox(height: GlassSpacing.sm),
            Text(
              'Try selecting a different category.',
              style: GlassTypography.bodyMedium(
                color: GlassColors.textTertiary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  Widget _buildErrorState(Object error) {
    return Center(
      child: Padding(
        padding: GlassSpacing.screenPadding,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: GlassColors.error,
            ),
            const SizedBox(height: GlassSpacing.lg),
            Text(
              'Something went wrong',
              style: GlassTypography.headline3(
                color: GlassColors.textPrimary,
              ),
            ),
            const SizedBox(height: GlassSpacing.sm),
            Text(
              error.toString(),
              style: GlassTypography.bodySmall(),
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: GlassSpacing.xl),
            TextButton.icon(
              onPressed: _refresh,
              icon: const Icon(Icons.refresh, size: 20),
              label: Text(
                'Retry',
                style: GlassTypography.labelLarge(
                  color: GlassColors.primary,
                ),
              ),
              style: TextButton.styleFrom(
                foregroundColor: GlassColors.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  String _formatDate(String iso) {
    final date = DateTime.tryParse(iso);
    if (date == null) return iso;
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }
}

// ---------------------------------------------------------------------------
// Shimmer skeleton card
// ---------------------------------------------------------------------------

class _ShimmerCard extends StatefulWidget {
  @override
  State<_ShimmerCard> createState() => _ShimmerCardState();
}

class _ShimmerCardState extends State<_ShimmerCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _animation = CurvedAnimation(parent: _controller, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, _) {
        final opacity = 0.08 + (_animation.value * 0.12);
        return GlassCard(
          padding: GlassSpacing.cardPadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _shimmerBox(width: 80, height: 20, opacity: opacity),
              const SizedBox(height: GlassSpacing.md),
              _shimmerBox(width: double.infinity, height: 18, opacity: opacity),
              const SizedBox(height: GlassSpacing.sm),
              _shimmerBox(width: 200, height: 18, opacity: opacity),
              const SizedBox(height: GlassSpacing.md),
              _shimmerBox(width: double.infinity, height: 14, opacity: opacity),
              const SizedBox(height: GlassSpacing.xs),
              _shimmerBox(width: double.infinity, height: 14, opacity: opacity),
              const SizedBox(height: GlassSpacing.xs),
              _shimmerBox(width: 160, height: 14, opacity: opacity),
              const SizedBox(height: GlassSpacing.lg),
              _shimmerBox(width: 120, height: 12, opacity: opacity),
            ],
          ),
        );
      },
    );
  }

  Widget _shimmerBox({
    required double height,
    required double opacity,
    double? width,
  }) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: GlassColors.textTertiary.withOpacity(opacity),
        borderRadius: BorderRadius.circular(GlassRadius.xs),
      ),
    );
  }
}

